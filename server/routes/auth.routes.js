const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const router = express.Router();

function signToken(user) {
    return jwt.sign({ userId: user.UserID, username: user.Username }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    });
}

function toPublicUser(user) {
    return {
        userId: user.UserID,
        username: user.Username,
        fullName: user.FullName,
        avatar: user.Avatar,
        email: user.Email,
        phone: user.Phone,
        status: user.Status,
    };
}

// POST /api/auth/register — FR-01
router.post('/register', async (req, res) => {
    const { username, password, fullName, email, phone } = req.body;

    if (!username || !password || !fullName) {
        return res.status(400).json({ message: 'Thiếu username, password hoặc fullName' });
    }

    try {
        const [existing] = await pool.query(
            'SELECT UserID FROM Users WHERE Username = ? OR (Email IS NOT NULL AND Email = ?)',
            [username, email || null]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Username hoặc email đã được sử dụng' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO Users (Username, PasswordHash, FullName, Email, Phone) VALUES (?, ?, ?, ?, ?)',
            [username, passwordHash, fullName, email || null, phone || null]
        );

        const [rows] = await pool.query('SELECT * FROM Users WHERE UserID = ?', [result.insertId]);
        const user = rows[0];
        const token = signToken(user);

        res.status(201).json({ token, user: toPublicUser(user) });
    } catch (err) {
        console.error('register error:', err);
        res.status(500).json({ message: 'Lỗi server khi đăng ký' });
    }
});

// POST /api/auth/login — FR-02
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Thiếu username hoặc password' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT * FROM Users WHERE Username = ? OR Email = ?',
            [username, username]
        );
        const user = rows[0];
        if (!user) {
            return res.status(401).json({ message: 'Sai username/email hoặc mật khẩu' });
        }

        const match = await bcrypt.compare(password, user.PasswordHash);
        if (!match) {
            return res.status(401).json({ message: 'Sai username/email hoặc mật khẩu' });
        }

        const token = signToken(user);
        res.json({ token, user: toPublicUser(user) });
    } catch (err) {
        console.error('login error:', err);
        res.status(500).json({ message: 'Lỗi server khi đăng nhập' });
    }
});

module.exports = router;
