const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');

// Used for both /api/leads/:id/activity and /api/activity (recent global)
const router = express.Router({ mergeParams: true });
router.use(authenticateToken);

// GET /api/leads/:id/activity  — activity for one lead
router.get('/', async (req, res, next) => {
  try {
    if (!req.params.id) return next();           // fall through to global handler below

    const lead = await db.get('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) throw new ApiError(404, 'Lead not found.');

    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset || '0',  10), 0);

    const rows = await db.all(
      `SELECT a.*, l.lead_name, l.company_name
       FROM lead_activity a
       JOIN leads l ON l.id = a.lead_id
       WHERE a.lead_id = ?
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.params.id, limit, offset]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/activity/recent  — last N activities across all leads
// Mounted separately in server.js as /api/activity
router.get('/recent', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const rows  = await db.all(
      `SELECT a.*, l.lead_name, l.company_name
       FROM lead_activity a
       JOIN leads l ON l.id = a.lead_id
       ORDER BY a.created_at DESC
       LIMIT ?`,
      [limit]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

module.exports = router;
