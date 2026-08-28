const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router({ mergeParams: true });
router.use(authenticateToken);

// ── Global tag endpoints (no :id prefix) ──────────────────────────────────────

// GET /api/tags  — all available tags
router.get('/all', async (req, res, next) => {
  try {
    const tags = await db.all('SELECT * FROM tags ORDER BY name');
    res.json({ success: true, data: tags });
  } catch (err) { next(err); }
});

// POST /api/tags  — create a new global tag
router.post('/create', async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name || !String(name).trim()) throw new ApiError(422, 'Tag name is required.');
    const info = await db.run(
      'INSERT INTO tags (name, color) VALUES (?, ?) ON CONFLICT (name) DO NOTHING RETURNING id',
      [String(name).trim(), color || '#6366f1']
    );
    const tag = await db.get('SELECT * FROM tags WHERE name = ?', [String(name).trim()]);
    res.status(201).json({ success: true, data: tag });
  } catch (err) { next(err); }
});

// ── Per-lead tag endpoints (/api/leads/:id/tags) ──────────────────────────────

// GET /api/leads/:id/tags
router.get('/', async (req, res, next) => {
  try {
    if (!req.params.id) return res.json({ success: true, data: [] });
    const tags = await db.all(
      `SELECT t.* FROM tags t
       JOIN lead_tags lt ON lt.tag_id = t.id
       WHERE lt.lead_id = ?
       ORDER BY t.name`,
      [req.params.id]
    );
    res.json({ success: true, data: tags });
  } catch (err) { next(err); }
});

// POST /api/leads/:id/tags  — attach a tag by id
router.post('/', async (req, res, next) => {
  try {
    const lead = await db.get('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) throw new ApiError(404, 'Lead not found.');

    const { tag_id } = req.body;
    if (!tag_id) throw new ApiError(422, 'tag_id is required.');

    const tag = await db.get('SELECT * FROM tags WHERE id = ?', [tag_id]);
    if (!tag) throw new ApiError(404, 'Tag not found.');

    await db.run(
      'INSERT INTO lead_tags (lead_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
      [req.params.id, tag_id]
    );

    const actor = req.user?.username || 'admin';
    await db.run(
      'INSERT INTO lead_activity (lead_id, action, description, actor) VALUES (?, ?, ?, ?)',
      [req.params.id, 'tag_added', `Tag "${tag.name}" added`, actor]
    );

    res.status(201).json({ success: true, message: 'Tag attached.' });
  } catch (err) { next(err); }
});

// DELETE /api/leads/:id/tags/:tagId  — detach a tag
router.delete('/:tagId', async (req, res, next) => {
  try {
    await db.run(
      'DELETE FROM lead_tags WHERE lead_id = ? AND tag_id = ?',
      [req.params.id, req.params.tagId]
    );
    res.json({ success: true, message: 'Tag removed.' });
  } catch (err) { next(err); }
});

module.exports = router;
