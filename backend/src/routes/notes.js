const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');

// mergeParams lets this router read :id from /api/leads/:id/notes
const router = express.Router({ mergeParams: true });
router.use(authenticateToken);

// GET /api/leads/:id/notes
router.get('/', async (req, res, next) => {
  try {
    const lead = await db.get('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) throw new ApiError(404, 'Lead not found.');

    const notes = await db.all(
      'SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ success: true, data: notes });
  } catch (err) { next(err); }
});

// POST /api/leads/:id/notes
router.post('/', async (req, res, next) => {
  try {
    const lead = await db.get('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) throw new ApiError(404, 'Lead not found.');

    const { note } = req.body;
    if (!note || !String(note).trim()) throw new ApiError(422, 'Note text is required.');

    const actor = req.user?.username || 'admin';
    const info  = await db.run(
      'INSERT INTO lead_notes (lead_id, note, created_by) VALUES (?, ?, ?)',
      [req.params.id, String(note).trim(), actor]
    );

    // Log activity
    await db.run(
      'INSERT INTO lead_activity (lead_id, action, description, actor) VALUES (?, ?, ?, ?)',
      [req.params.id, 'note_added', `Note added by ${actor}`, actor]
    );

    const created = await db.get('SELECT * FROM lead_notes WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json({ success: true, data: created });
  } catch (err) { next(err); }
});

// PATCH /api/leads/:id/notes/:noteId
router.patch('/:noteId', async (req, res, next) => {
  try {
    const note = await db.get(
      'SELECT * FROM lead_notes WHERE id = ? AND lead_id = ?',
      [req.params.noteId, req.params.id]
    );
    if (!note) throw new ApiError(404, 'Note not found.');

    const { note: newText } = req.body;
    if (!newText || !String(newText).trim()) throw new ApiError(422, 'Note text is required.');

    await db.run(
      'UPDATE lead_notes SET note = ?, updated_at = NOW() WHERE id = ?',
      [String(newText).trim(), req.params.noteId]
    );
    const updated = await db.get('SELECT * FROM lead_notes WHERE id = ?', [req.params.noteId]);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// DELETE /api/leads/:id/notes/:noteId
router.delete('/:noteId', async (req, res, next) => {
  try {
    const note = await db.get(
      'SELECT * FROM lead_notes WHERE id = ? AND lead_id = ?',
      [req.params.noteId, req.params.id]
    );
    if (!note) throw new ApiError(404, 'Note not found.');

    await db.run('DELETE FROM lead_notes WHERE id = ?', [req.params.noteId]);
    res.json({ success: true, message: 'Note deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
