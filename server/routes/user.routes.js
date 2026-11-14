const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/users — danh sách người dùng khác để bắt đầu trò chuyện mới (FR-03)
router.get('/', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT UserID, Username, FullName, Avatar, Status FROM Users WHERE UserID != ? ORDER BY FullName',
            [req.user.userId]
        );
        res.json(
            rows.map((u) => ({
                userId: u.UserID,
                username: u.Username,
                fullName: u.FullName,
                avatar: u.Avatar,
                status: u.Status,
            }))
        );
    } catch (err) {
        console.error('list users error:', err);
        res.status(500).json({ message: 'Lỗi server khi lấy danh sách người dùng' });
    }
});

module.exports = router;
