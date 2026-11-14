const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// userId -> Set<socketId>, cho phép một user mở nhiều tab/thiết bị
const onlineSockets = new Map();

function authenticateSocket(socket, next) {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Thiếu token xác thực'));

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = payload.userId;
        socket.username = payload.username;
        next();
    } catch (err) {
        next(new Error('Token không hợp lệ hoặc đã hết hạn'));
    }
}

function formatMessage(m, attachments = []) {
    return {
        messageId: m.MessageID,
        conversationId: m.ConversationID,
        senderId: m.SenderID,
        content: m.Content,
        messageType: m.MessageType,
        sentAt: m.SentAt,
        status: m.Status,
        attachments: attachments.map((a) => ({ fileUrl: a.FileURL, fileType: a.FileType })),
    };
}

async function joinOwnConversations(socket) {
    const [rows] = await pool.query(
        'SELECT ConversationID FROM ConversationMembers WHERE UserID = ?',
        [socket.userId]
    );
    rows.forEach((r) => socket.join(`conversation:${r.ConversationID}`));
}

function registerChatSocket(io) {
    io.use(authenticateSocket);

    io.on('connection', async (socket) => {
        const { userId } = socket;

        if (!onlineSockets.has(userId)) onlineSockets.set(userId, new Set());
        onlineSockets.get(userId).add(socket.id);

        await joinOwnConversations(socket);

        if (onlineSockets.get(userId).size === 1) {
            await pool.query("UPDATE Users SET Status = 'online' WHERE UserID = ?", [userId]);
            io.emit('userStatus', { userId, status: 'online' });
        }

        // Cho phép client join phòng ngay sau khi tạo cuộc trò chuyện mới (chưa cần reconnect)
        socket.on('joinConversation', (conversationId) => {
            socket.join(`conversation:${conversationId}`);
        });

        // sendMessage — FR-04: client gửi tin nhắn mới qua Socket.io
        socket.on('sendMessage', async ({ conversationId, content, messageType, clientId }, ack) => {
            try {
                const [members] = await pool.query(
                    'SELECT 1 FROM ConversationMembers WHERE ConversationID = ? AND UserID = ?',
                    [conversationId, userId]
                );
                if (members.length === 0) {
                    if (typeof ack === 'function') ack({ error: 'Bạn không thuộc cuộc trò chuyện này', clientId });
                    return;
                }

                const [result] = await pool.query(
                    "INSERT INTO Messages (ConversationID, SenderID, Content, MessageType, Status) VALUES (?, ?, ?, ?, 'sent')",
                    [conversationId, userId, content, messageType || 'text']
                );
                const [[row]] = await pool.query('SELECT * FROM Messages WHERE MessageID = ?', [result.insertId]);
                const message = formatMessage(row);

                if (typeof ack === 'function') ack({ message, clientId });
                socket.to(`conversation:${conversationId}`).emit('newMessage', message);
            } catch (err) {
                console.error('sendMessage error:', err);
                if (typeof ack === 'function') ack({ error: 'Lỗi server khi gửi tin nhắn', clientId });
            }
        });

        socket.on('disconnect', async () => {
            const sockets = onlineSockets.get(userId);
            if (!sockets) return;
            sockets.delete(socket.id);

            if (sockets.size === 0) {
                onlineSockets.delete(userId);
                await pool.query("UPDATE Users SET Status = 'offline' WHERE UserID = ?", [userId]);
                io.emit('userStatus', { userId, status: 'offline' });
            }
        });
    });
}

module.exports = { registerChatSocket };
