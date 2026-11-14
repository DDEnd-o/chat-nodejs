const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/conversations — danh sách cuộc trò chuyện của user hiện tại (FR-03)
router.get('/', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT c.ConversationID,
                    u.UserID AS OtherUserID, u.Username, u.FullName, u.Avatar, u.Status,
                    lm.Content AS LastContent, lm.MessageType AS LastMessageType, lm.SentAt AS LastSentAt
             FROM Conversations c
             JOIN ConversationMembers me ON me.ConversationID = c.ConversationID AND me.UserID = ?
             JOIN ConversationMembers other ON other.ConversationID = c.ConversationID AND other.UserID != ?
             JOIN Users u ON u.UserID = other.UserID
             LEFT JOIN Messages lm ON lm.MessageID = (
                 SELECT m.MessageID FROM Messages m
                 WHERE m.ConversationID = c.ConversationID
                 ORDER BY m.SentAt DESC, m.MessageID DESC LIMIT 1
             )
             WHERE c.Type = 'direct'
             ORDER BY lm.SentAt DESC`,
            [req.user.userId, req.user.userId]
        );

        res.json(
            rows.map((r) => ({
                conversationId: r.ConversationID,
                otherUser: {
                    userId: r.OtherUserID,
                    username: r.Username,
                    fullName: r.FullName,
                    avatar: r.Avatar,
                    status: r.Status,
                },
                lastMessage: r.LastContent !== null || r.LastMessageType
                    ? { content: r.LastContent, messageType: r.LastMessageType, sentAt: r.LastSentAt }
                    : null,
            }))
        );
    } catch (err) {
        console.error('list conversations error:', err);
        res.status(500).json({ message: 'Lỗi server khi lấy danh sách cuộc trò chuyện' });
    }
});

// POST /api/conversations { otherUserId } — lấy hoặc tạo cuộc trò chuyện 1-1
router.post('/', requireAuth, async (req, res) => {
    const { otherUserId } = req.body;
    if (!otherUserId || Number(otherUserId) === req.user.userId) {
        return res.status(400).json({ message: 'otherUserId không hợp lệ' });
    }

    const connection = await pool.getConnection();
    try {
        const [existing] = await connection.query(
            `SELECT c.ConversationID FROM Conversations c
             JOIN ConversationMembers m1 ON m1.ConversationID = c.ConversationID AND m1.UserID = ?
             JOIN ConversationMembers m2 ON m2.ConversationID = c.ConversationID AND m2.UserID = ?
             WHERE c.Type = 'direct' LIMIT 1`,
            [req.user.userId, otherUserId]
        );

        if (existing.length > 0) {
            return res.json({ conversationId: existing[0].ConversationID });
        }

        await connection.beginTransaction();
        const [result] = await connection.query("INSERT INTO Conversations (Type) VALUES ('direct')");
        const conversationId = result.insertId;
        await connection.query(
            'INSERT INTO ConversationMembers (ConversationID, UserID) VALUES (?, ?), (?, ?)',
            [conversationId, req.user.userId, conversationId, otherUserId]
        );
        await connection.commit();

        res.status(201).json({ conversationId });
    } catch (err) {
        await connection.rollback();
        console.error('create conversation error:', err);
        res.status(500).json({ message: 'Lỗi server khi tạo cuộc trò chuyện' });
    } finally {
        connection.release();
    }
});

module.exports = router;
