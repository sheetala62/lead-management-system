const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticateToken);

// GET /api/filters  — list saved filters for the current user
router.get('/', async (req, res, next) => {
  try {
    const user = req.user?.username || 'admin';
    const rows = await db.all(
      'SELECT * FROM saved_filters WHERE created_by = ? ORDER BY created_at DESC',
      [user]
    );
    res.json({ success: true, data: rows.map(r => ({ ...r, filter: JSON.parse(r.filter_json) })) });
  } catch (err) { next(err); }
});

// POST /api/filters  — save a new filter
router.post('/', async (req, res, next) => {
  try {
    const { name, filter } = req.body;
    if (!name || !String(name).trim()) throw new ApiError(422, 'Filter name is required.');
    if (!filter || typeof filter !== 'object') throw new ApiError(422, 'filter object is required.');

    const user = req.user?.username || 'admin';
    const info = await db.run(
      'INSERT INTO saved_filters (name, created_by, filter_json) VALUES (?, ?, ?)',
      [String(name).trim(), user, JSON.stringify(filter)]
    );
    const created = await db.get('SELECT * FROM saved_filters WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json({ success: true, data: { ...created, filter: JSON.parse(created.filter_json) } });
  } catch (err) { next(err); }
});

// DELETE /api/filters/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const user = req.user?.username || 'admin';
    const row  = await db.get('SELECT id FROM saved_filters WHERE id = ? AND created_by = ?', [req.params.id, user]);
    if (!row) throw new ApiError(404, 'Saved filter not found.');
    await db.run('DELETE FROM saved_filters WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Filter deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
