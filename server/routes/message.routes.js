const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads'),
    filename: (req, file, cb) => {
        const unique = crypto.randomBytes(8).toString('hex');
        cb(null, `${Date.now()}-${unique}${path.extname(file.originalname)}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Chỉ hỗ trợ tập tin hình ảnh'));
        }
        cb(null, true);
    },
});

async function assertMember(conversationId, userId) {
    const [rows] = await pool.query(
        'SELECT 1 FROM ConversationMembers WHERE ConversationID = ? AND UserID = ?',
        [conversationId, userId]
    );
    return rows.length > 0;
}

async function loadMessageWithAttachment(messageId) {
    const [[message]] = await pool.query('SELECT * FROM Messages WHERE MessageID = ?', [messageId]);
    const [attachments] = await pool.query('SELECT * FROM Attachments WHERE MessageID = ?', [messageId]);
    return formatMessage(message, attachments);
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

// GET /api/messages/:conversationId — lịch sử tin nhắn (FR-06)
router.get('/:conversationId', requireAuth, async (req, res) => {
    const { conversationId } = req.params;

    try {
        if (!(await assertMember(conversationId, req.user.userId))) {
            return res.status(403).json({ message: 'Bạn không thuộc cuộc trò chuyện này' });
        }

        const [messages] = await pool.query(
            'SELECT * FROM Messages WHERE ConversationID = ? ORDER BY SentAt ASC, MessageID ASC',
            [conversationId]
        );
        const [attachments] = await pool.query(
            `SELECT a.* FROM Attachments a
             JOIN Messages m ON m.MessageID = a.MessageID
             WHERE m.ConversationID = ?`,
            [conversationId]
        );
        const byMessage = new Map();
        attachments.forEach((a) => {
            if (!byMessage.has(a.MessageID)) byMessage.set(a.MessageID, []);
            byMessage.get(a.MessageID).push(a);
        });

        res.json(messages.map((m) => formatMessage(m, byMessage.get(m.MessageID) || [])));
    } catch (err) {
        console.error('get messages error:', err);
        res.status(500).json({ message: 'Lỗi server khi lấy lịch sử tin nhắn' });
    }
});

// POST /api/messages/:conversationId/image — gửi tin nhắn kèm ảnh (FR-05)
router.post('/:conversationId/image', requireAuth, upload.single('image'), async (req, res) => {
    const { conversationId } = req.params;
    const caption = req.body.caption || null;

    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Thiếu tập tin ảnh' });
        }
        if (!(await assertMember(conversationId, req.user.userId))) {
            return res.status(403).json({ message: 'Bạn không thuộc cuộc trò chuyện này' });
        }

        const [result] = await pool.query(
            "INSERT INTO Messages (ConversationID, SenderID, Content, MessageType) VALUES (?, ?, ?, 'image')",
            [conversationId, req.user.userId, caption]
        );
        const fileUrl = `/uploads/${req.file.filename}`;
        await pool.query(
            'INSERT INTO Attachments (MessageID, FileURL, FileType) VALUES (?, ?, ?)',
            [result.insertId, fileUrl, req.file.mimetype]
        );

        const message = await loadMessageWithAttachment(result.insertId);

        const io = req.app.get('io');
        io.to(`conversation:${conversationId}`).emit('newMessage', message);

        res.status(201).json(message);
    } catch (err) {
        console.error('send image error:', err);
        res.status(500).json({ message: 'Lỗi server khi gửi ảnh' });
    }
});

module.exports = router;
