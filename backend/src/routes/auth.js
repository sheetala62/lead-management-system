const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new ApiError(400, 'Username and password are required.');
    }

    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    // Same generic message whether username or password is wrong -
    // avoids leaking which part was incorrect.
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw new ApiError(401, 'Invalid username or password.');
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
// JWTs are stateless, so "logout" is really the client discarding the token.
// This endpoint exists so the frontend has a clean call to make, and so a
// token blacklist could be added later without changing the API contract.
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
