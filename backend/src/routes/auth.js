/**
 * auth.js — Authentication routes
 *
 * POST /api/auth/login                  login
 * POST /api/auth/logout                 logout (stateless)
 * POST /api/auth/forgot-password        send reset email
 * POST /api/auth/reset-password         consume token + set new password
 * GET  /api/auth/verify-email/:token    verify email address
 * POST /api/auth/resend-verification    resend verification email
 */

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const db       = require('../db');
const mailer   = require('../utils/mailer');
const { authenticateToken } = require('../middleware/auth');
const { ApiError }          = require('../middleware/errorHandler');

const router = express.Router();

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    ''
  );
}

async function recordLogin(userId, username, req, status = 'success') {
  try {
    await db.run(
      'INSERT INTO login_history (user_id, username, ip_address, user_agent, status) VALUES (?,?,?,?,?)',
      [userId, username, getIp(req), req.headers['user-agent'] || '', status]
    );
    if (status === 'success') {
      await db.run('UPDATE users SET last_login=NOW() WHERE id=?', [userId]);
    }
  } catch { /* non-critical */ }
}

/* ── POST /api/auth/login ────────────────────────────────────────────────────── */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) throw new ApiError(400, 'Username and password are required.');

    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      // Record failed attempt if user exists
      if (user) await recordLogin(user.id, username, req, 'failed');
      throw new ApiError(401, 'Invalid username or password.');
    }

    if (user.is_active === 0) throw new ApiError(403, 'Your account has been deactivated. Contact your administrator.');

    await recordLogin(user.id, username, req, 'success');

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id, username: user.username, role: user.role,
        full_name: user.full_name || '', email: user.email || '',
        avatar_url: user.avatar_url || '', email_verified: user.email_verified,
      },
    });
  } catch (err) { next(err); }
});

/* ── POST /api/auth/logout ───────────────────────────────────────────────────── */
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

/* ── POST /api/auth/forgot-password ─────────────────────────────────────────── */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email, username } = req.body;
    if (!email && !username) throw new ApiError(422, 'Email or username is required.');

    let user = null;
    if (email)    user = await db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)',    [email]);
    if (!user && username) user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    // Always return success to prevent user enumeration
    if (!user) {
      return res.json({ success: true, message: 'If that account exists, a reset email has been sent.' });
    }

    // Expire any old tokens for this user
    await db.run('UPDATE password_reset_tokens SET used=1 WHERE user_id=? AND used=0', [user.id]);

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600_000); // 1 hour

    await db.run(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?,?,?)',
      [user.id, token, expiresAt.toISOString()]
    );

    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || '';
    const resetUrl    = `${frontendUrl}/reset-password.html?token=${token}`;

    await mailer.sendTemplate('password_reset', {
      full_name: user.full_name || user.username,
      reset_url: resetUrl,
    }, user.email || '');

    res.json({ success: true, message: 'If that account exists, a reset email has been sent.' });
  } catch (err) { next(err); }
});

/* ── POST /api/auth/reset-password ──────────────────────────────────────────── */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) throw new ApiError(422, 'Token and new_password are required.');
    if (new_password.length < 6) throw new ApiError(422, 'Password must be at least 6 characters.');

    const row = await db.get(
      'SELECT * FROM password_reset_tokens WHERE token=? AND used=0 AND expires_at > NOW()',
      [token]
    );
    if (!row) throw new ApiError(400, 'Invalid or expired reset token.');

    const hash = bcrypt.hashSync(new_password, 10);
    await db.run('UPDATE users SET password_hash=?, updated_at=NOW() WHERE id=?', [hash, row.user_id]);
    await db.run('UPDATE password_reset_tokens SET used=1 WHERE id=?', [row.id]);

    // Audit
    try {
      await db.run(
        'INSERT INTO audit_logs (actor, action, entity_type, entity_id, description) VALUES (?,?,?,?,?)',
        ['system', 'password_reset', 'user', row.user_id, 'Password reset via email token']
      );
    } catch { /* non-critical */ }

    res.json({ success: true, message: 'Password has been reset. You can now log in.' });
  } catch (err) { next(err); }
});

/* ── POST /api/auth/resend-verification ─────────────────────────────────────── */
router.post('/resend-verification', authenticateToken, async (req, res, next) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!user) throw new ApiError(404, 'User not found.');
    if (user.email_verified) return res.json({ success: true, message: 'Email already verified.' });
    if (!user.email) throw new ApiError(422, 'No email address on your account. Please update your profile first.');

    await db.run('UPDATE email_verification_tokens SET used=1 WHERE user_id=? AND used=0', [user.id]);

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 86400_000); // 24 hours
    await db.run(
      'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?,?,?)',
      [user.id, token, expiresAt.toISOString()]
    );

    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || '';
    const verifyUrl   = `${frontendUrl}/verify-email.html?token=${token}`;

    await mailer.sendTemplate('email_verification', {
      full_name:  user.full_name || user.username,
      verify_url: verifyUrl,
    }, user.email);

    res.json({ success: true, message: 'Verification email sent.' });
  } catch (err) { next(err); }
});

/* ── GET /api/auth/verify-email/:token ───────────────────────────────────────── */
router.get('/verify-email/:token', async (req, res, next) => {
  try {
    const row = await db.get(
      'SELECT * FROM email_verification_tokens WHERE token=? AND used=0 AND expires_at > NOW()',
      [req.params.token]
    );
    if (!row) throw new ApiError(400, 'Invalid or expired verification link.');

    await db.run('UPDATE users SET email_verified=1, updated_at=NOW() WHERE id=?', [row.user_id]);
    await db.run('UPDATE email_verification_tokens SET used=1 WHERE id=?', [row.id]);

    res.json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (err) { next(err); }
});

module.exports = router;
