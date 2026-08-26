const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { validateFollowupPayload } = require('../utils/validators');

// mergeParams lets this router read :id from the parent /api/leads/:id mount
const router = express.Router({ mergeParams: true });
router.use(authenticateToken);

// GET /api/leads/:id/followups
router.get('/', async (req, res, next) => {
  try {
    const lead = await db.get('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) throw new ApiError(404, 'Lead not found.');

    const followups = await db.all(
      'SELECT * FROM followups WHERE lead_id = ? ORDER BY followup_date DESC, id DESC',
      [req.params.id]
    );

    res.json({ success: true, data: followups });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/:id/followups
router.post('/', async (req, res, next) => {
  try {
    const lead = await db.get('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) throw new ApiError(404, 'Lead not found.');

    const { valid, errors } = validateFollowupPayload(req.body);
    if (!valid) throw Object.assign(new ApiError(422, 'Validation failed.'), { errors });

    const b = req.body;
    const info = await db.run(`
      INSERT INTO followups (lead_id, followup_date, followup_type, remarks, next_followup_date)
      VALUES (?, ?, ?, ?, ?)
    `, [req.params.id, b.followup_date, b.followup_type, b.remarks || null, b.next_followup_date || null]);

    const created = await db.get('SELECT * FROM followups WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
