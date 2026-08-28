/**
 * users.js — User profile + staff management routes
 *
 * GET    /api/users/me                  get own profile
 * PUT    /api/users/me                  update own profile (name, email, phone)
 * PUT    /api/users/me/avatar           update avatar (base64 data-url)
 * PUT    /api/users/me/password         change own password
 *
 * GET    /api/users                     list all users  [admin]
 * POST   /api/users                     create staff user  [admin]
 * PUT    /api/users/:id                 update any user  [admin]
 * DELETE /api/users/:id                 deactivate user  [admin]
 * POST   /api/users/:id/reset-password  force-reset password  [admin]
 */

const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { requireRole }       = require('../middleware/roleGuard');
const { ApiError }          = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticateToken);

const SAFE_USER = (u) => ({
  id: u.id, username: u.username, full_name: u.full_name || '',
  email: u.email || '', phone: u.phone || '',
  avatar_url: u.avatar_url || '', role: u.role,
  is_active: u.is_active, email_verified: u.email_verified,
  last_login: u.last_login, created_at: u.created_at,
});

/* ── Own profile ─────────────────────────────────────────────────────────────── */

router.get('/me', async (req, res, next) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) throw new ApiError(404, 'User not found.');
    res.json({ success: true, data: SAFE_USER(user) });
  } catch (err) { next(err); }
});

router.put('/me', async (req, res, next) => {
  try {
    const { full_name = '', email = '', phone = '' } = req.body;
    await db.run(
      'UPDATE users SET full_name=?, email=?, phone=?, updated_at=NOW() WHERE id=?',
      [full_name.trim(), email.trim().toLowerCase(), phone.trim(), req.user.id]
    );
    const updated = await db.get('SELECT * FROM users WHERE id=?', [req.user.id]);
    res.json({ success: true, data: SAFE_USER(updated) });
  } catch (err) { next(err); }
});

router.put('/me/avatar', async (req, res, next) => {
  try {
    const { avatar_url } = req.body;
    if (!avatar_url) throw new ApiError(422, 'avatar_url is required.');
    // Accept data-URL (base64) or https URL — store as-is (max ~200KB recommended)
    if (avatar_url.length > 300000) throw new ApiError(413, 'Avatar too large. Keep under 200 KB.');
    await db.run('UPDATE users SET avatar_url=?, updated_at=NOW() WHERE id=?', [avatar_url, req.user.id]);
    res.json({ success: true, message: 'Avatar updated.' });
  } catch (err) { next(err); }
});

router.put('/me/password', async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) throw new ApiError(422, 'Both current and new passwords are required.');
    if (new_password.length < 6) throw new ApiError(422, 'New password must be at least 6 characters.');

    const user = await db.get('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      throw new ApiError(401, 'Current password is incorrect.');
    }
    const hash = bcrypt.hashSync(new_password, 10);
    await db.run('UPDATE users SET password_hash=?, updated_at=NOW() WHERE id=?', [hash, req.user.id]);

    // Audit log
    await logAudit(req, 'password_changed', 'user', req.user.id, 'User changed their own password');

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) { next(err); }
});

/* ── Staff management (admin only) ──────────────────────────────────────────── */

router.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    const users = await db.all('SELECT * FROM users ORDER BY created_at DESC');
    res.json({ success: true, data: users.map(SAFE_USER) });
  } catch (err) { next(err); }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { username, password, full_name = '', email = '', phone = '', role = 'staff' } = req.body;
    if (!username || !password) throw new ApiError(422, 'username and password are required.');
    if (!['admin','staff','manager'].includes(role)) throw new ApiError(422, 'Invalid role.');
    if (password.length < 6) throw new ApiError(422, 'Password must be at least 6 characters.');

    const existing = await db.get('SELECT id FROM users WHERE username=?', [username]);
    if (existing) throw new ApiError(409, 'Username already exists.');

    const hash = bcrypt.hashSync(password, 10);
    const info = await db.run(
      'INSERT INTO users (username, password_hash, full_name, email, phone, role) VALUES (?,?,?,?,?,?)',
      [username.trim(), hash, full_name.trim(), email.trim().toLowerCase(), phone.trim(), role]
    );

    await logAudit(req, 'user_created', 'user', info.lastInsertRowid,
      `Staff user "${username}" created with role "${role}" by ${req.user.username}`);

    const created = await db.get('SELECT * FROM users WHERE id=?', [info.lastInsertRowid]);
    res.status(201).json({ success: true, data: SAFE_USER(created) });
  } catch (err) { next(err); }
});

router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const target = await db.get('SELECT * FROM users WHERE id=?', [req.params.id]);
    if (!target) throw new ApiError(404, 'User not found.');

    const { full_name, email, phone, role, is_active } = req.body;
    await db.run(
      'UPDATE users SET full_name=?, email=?, phone=?, role=?, is_active=?, updated_at=NOW() WHERE id=?',
      [
        full_name ?? target.full_name,
        (email ?? target.email).toLowerCase(),
        phone ?? target.phone,
        role ?? target.role,
        is_active !== undefined ? (is_active ? 1 : 0) : target.is_active,
        req.params.id,
      ]
    );

    await logAudit(req, 'user_updated', 'user', Number(req.params.id),
      `User "${target.username}" updated by ${req.user.username}`);

    const updated = await db.get('SELECT * FROM users WHERE id=?', [req.params.id]);
    res.json({ success: true, data: SAFE_USER(updated) });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (Number(req.params.id) === req.user.id) throw new ApiError(400, 'Cannot deactivate your own account.');
    const target = await db.get('SELECT * FROM users WHERE id=?', [req.params.id]);
    if (!target) throw new ApiError(404, 'User not found.');

    // Soft-delete: deactivate rather than hard delete
    await db.run('UPDATE users SET is_active=0, updated_at=NOW() WHERE id=?', [req.params.id]);
    await logAudit(req, 'user_deactivated', 'user', Number(req.params.id),
      `User "${target.username}" deactivated by ${req.user.username}`);

    res.json({ success: true, message: 'User deactivated.' });
  } catch (err) { next(err); }
});

router.post('/:id/reset-password', requireRole('admin'), async (req, res, next) => {
  try {
    const target = await db.get('SELECT * FROM users WHERE id=?', [req.params.id]);
    if (!target) throw new ApiError(404, 'User not found.');

    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) throw new ApiError(422, 'New password must be at least 6 characters.');

    const hash = bcrypt.hashSync(new_password, 10);
    await db.run('UPDATE users SET password_hash=?, updated_at=NOW() WHERE id=?', [hash, req.params.id]);

    await logAudit(req, 'password_reset_admin', 'user', Number(req.params.id),
      `Password of "${target.username}" reset by admin ${req.user.username}`);

    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) { next(err); }
});

/* ── Helper ──────────────────────────────────────────────────────────────────── */
async function logAudit(req, action, entityType, entityId, description) {
  try {
    const ip = req.ip || req.socket?.remoteAddress || '';
    await db.run(
      'INSERT INTO audit_logs (actor, action, entity_type, entity_id, description, ip_address) VALUES (?,?,?,?,?,?)',
      [req.user?.username || 'system', action, entityType, entityId, description, ip]
    );
  } catch { /* non-critical */ }
}

module.exports = router;
