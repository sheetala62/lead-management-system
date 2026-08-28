/**
 * admin.js — Admin-only panel routes
 *
 * GET  /api/admin/stats          system stats overview
 * GET  /api/admin/audit-logs     paginated audit log
 * GET  /api/admin/login-history  paginated login history
 * GET  /api/admin/assignees      list + manage assignees
 * POST /api/admin/assignees      create assignee
 * PUT  /api/admin/assignees/:id  update assignee
 * DELETE /api/admin/assignees/:id deactivate assignee
 */

const express = require('express');
const db      = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { requireRole }       = require('../middleware/roleGuard');
const { ApiError }          = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticateToken, requireRole('admin'));

/* ── System stats ────────────────────────────────────────────────────────────── */
router.get('/stats', async (req, res, next) => {
  try {
    const [
      totalLeads, totalUsers, activeUsers,
      totalFollowups, totalNotes,
      leadsThisMonth, recentLogins,
    ] = await Promise.all([
      db.get('SELECT COUNT(*) AS c FROM leads'),
      db.get('SELECT COUNT(*) AS c FROM users'),
      db.get('SELECT COUNT(*) AS c FROM users WHERE is_active=1'),
      db.get('SELECT COUNT(*) AS c FROM followups'),
      db.get('SELECT COUNT(*) AS c FROM lead_notes'),
      db.get(`SELECT COUNT(*) AS c FROM leads WHERE created_at >= DATE_TRUNC('month', NOW())`),
      db.get(`SELECT COUNT(*) AS c FROM login_history WHERE created_at >= NOW() - INTERVAL '24 hours' AND status='success'`),
    ]);

    res.json({
      success: true,
      data: {
        totalLeads:      Number(totalLeads.c),
        totalUsers:      Number(totalUsers.c),
        activeUsers:     Number(activeUsers.c),
        totalFollowups:  Number(totalFollowups.c),
        totalNotes:      Number(totalNotes.c),
        leadsThisMonth:  Number(leadsThisMonth.c),
        loginsLast24h:   Number(recentLogins.c),
      },
    });
  } catch (err) { next(err); }
});

/* ── Audit logs ──────────────────────────────────────────────────────────────── */
router.get('/audit-logs', async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset || '0',  10), 0);
    const actor  = req.query.actor || '';
    const action = req.query.action || '';

    const where  = [];
    const params = [];
    if (actor)  { where.push('actor ILIKE ?');  params.push(`%${actor}%`); }
    if (action) { where.push('action ILIKE ?'); params.push(`%${action}%`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = await db.get(`SELECT COUNT(*) AS c FROM audit_logs ${whereSql}`, params);
    const rows  = await db.all(
      `SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: rows, total: Number(total.c) });
  } catch (err) { next(err); }
});

/* ── Login history ───────────────────────────────────────────────────────────── */
router.get('/login-history', async (req, res, next) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit    || '50', 10), 200);
    const offset   = Math.max(parseInt(req.query.offset   || '0',  10), 0);
    const username = req.query.username || '';
    const status   = req.query.status   || '';

    const where  = [];
    const params = [];
    if (username) { where.push('username ILIKE ?'); params.push(`%${username}%`); }
    if (status)   { where.push('status = ?');       params.push(status); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = await db.get(`SELECT COUNT(*) AS c FROM login_history ${whereSql}`, params);
    const rows  = await db.all(
      `SELECT lh.*, u.full_name, u.email
       FROM login_history lh
       LEFT JOIN users u ON u.id = lh.user_id
       ${whereSql}
       ORDER BY lh.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: rows, total: Number(total.c) });
  } catch (err) { next(err); }
});

/* ── Assignees management ────────────────────────────────────────────────────── */
router.get('/assignees', async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM assignees ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/assignees', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) throw new ApiError(422, 'name is required.');
    const info = await db.run(
      'INSERT INTO assignees (name, active) VALUES (?, 1)',
      [String(name).trim()]
    );
    const created = await db.get('SELECT * FROM assignees WHERE id=?', [info.lastInsertRowid]);
    res.status(201).json({ success: true, data: created });
  } catch (err) { next(err); }
});

router.put('/assignees/:id', async (req, res, next) => {
  try {
    const { name, active } = req.body;
    const row = await db.get('SELECT * FROM assignees WHERE id=?', [req.params.id]);
    if (!row) throw new ApiError(404, 'Assignee not found.');
    await db.run(
      'UPDATE assignees SET name=?, active=? WHERE id=?',
      [name ?? row.name, active !== undefined ? (active ? 1 : 0) : row.active, req.params.id]
    );
    const updated = await db.get('SELECT * FROM assignees WHERE id=?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/assignees/:id', async (req, res, next) => {
  try {
    await db.run('UPDATE assignees SET active=0 WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Assignee deactivated.' });
  } catch (err) { next(err); }
});

module.exports = router;
