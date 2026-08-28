const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { validateLeadPayload } = require('../utils/validators');

const router = express.Router();
router.use(authenticateToken);

const SORTABLE_FIELDS = {
  date:            'created_at',
  created_at:      'created_at',
  estimated_value: 'estimated_value',
  lead_name:       'lead_name',
  priority:        'priority',
  updated_at:      'updated_at',
};

// Helper: attach tags array to each lead row
async function attachTags(leads) {
  if (!leads.length) return leads;
  const ids = leads.map(l => l.id);
  // Build parameterised list
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const rows = await db.all(
    `SELECT lt.lead_id, t.id, t.name, t.color
     FROM lead_tags lt JOIN tags t ON t.id = lt.tag_id
     WHERE lt.lead_id IN (${placeholders})`,
    ids
  );
  const map = {};
  rows.forEach(r => {
    if (!map[r.lead_id]) map[r.lead_id] = [];
    map[r.lead_id].push({ id: r.id, name: r.name, color: r.color });
  });
  return leads.map(l => ({ ...l, tags: map[l.id] || [] }));
}

// ── GET /api/leads ──────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const {
      search = '', status = '', service = '', assignedTo = '',
      priority = '', tag = '',
      dateFrom = '', dateTo = '',
      valueMin = '', valueMax = '',
      sortBy = 'date', sortDir = 'desc',
      page = '1', limit = '10',
    } = req.query;

    const where  = [];
    const params = [];

    if (search) {
      where.push('(lead_name ILIKE ? OR company_name ILIKE ? OR email ILIKE ? OR mobile ILIKE ?)');
      params.push(...Array(4).fill(`%${search}%`));
    }
    if (status)     { where.push('lead_status = ?');     params.push(status); }
    if (service)    { where.push('service_required = ?'); params.push(service); }
    if (assignedTo) { where.push('assigned_to = ?');     params.push(assignedTo); }
    if (priority)   { where.push('priority = ?');        params.push(priority); }
    if (dateFrom)   { where.push('created_at >= ?');     params.push(dateFrom); }
    if (dateTo)     { where.push('created_at <= ?');     params.push(dateTo + ' 23:59:59'); }
    if (valueMin)   { where.push('estimated_value >= ?'); params.push(Number(valueMin)); }
    if (valueMax)   { where.push('estimated_value <= ?'); params.push(Number(valueMax)); }

    // Tag filter: lead must have the given tag name
    if (tag) {
      where.push(`id IN (
        SELECT lt.lead_id FROM lead_tags lt
        JOIN tags t ON t.id = lt.tag_id
        WHERE t.name = ?
      )`);
      params.push(tag);
    }

    const whereSql      = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sortCol       = SORTABLE_FIELDS[sortBy] || 'created_at';
    const sortDirection = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const totalRow = await db.get(`SELECT COUNT(*) AS c FROM leads ${whereSql}`, params);
    const total    = Number(totalRow.c);

    const pageNum  = Math.max(parseInt(page,  10) || 1,  1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const offset   = (pageNum - 1) * limitNum;

    const rows = await db.all(
      `SELECT * FROM leads ${whereSql} ORDER BY ${sortCol} ${sortDirection} LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const data = await attachTags(rows);

    res.json({
      success: true,
      data,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 },
    });
  } catch (err) { next(err); }
});

// ── GET /api/leads/duplicate-check ─────────────────────────────────────────
router.get('/duplicate-check', async (req, res, next) => {
  try {
    const { mobile = '', email = '', excludeId = '' } = req.query;
    if (!mobile && !email) return res.json({ success: true, duplicates: [] });

    const conds  = [];
    const params = [];
    if (mobile) { conds.push('mobile = ?'); params.push(mobile); }
    if (email)  { conds.push('email = ?');  params.push(email);  }

    let sql = `SELECT id, lead_name, company_name, mobile, email, lead_status FROM leads WHERE (${conds.join(' OR ')})`;
    if (excludeId) { sql += ' AND id != ?'; params.push(excludeId); }

    const duplicates = await db.all(sql, params);
    res.json({ success: true, duplicates });
  } catch (err) { next(err); }
});

// ── GET /api/leads/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) throw new ApiError(404, 'Lead not found.');
    const [withTags] = await attachTags([lead]);
    res.json({ success: true, data: withTags });
  } catch (err) { next(err); }
});

// ── POST /api/leads ─────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { valid, errors } = validateLeadPayload(req.body);
    if (!valid) throw Object.assign(new ApiError(422, 'Validation failed.'), { errors });

    const b    = req.body;
    const dup  = await db.get('SELECT id FROM leads WHERE mobile = ? OR email = ?', [b.mobile, b.email]);
    const actor = req.user?.username || 'admin';

    const info = await db.run(`
      INSERT INTO leads
        (lead_name, company_name, mobile, email, service_required, lead_source,
         estimated_value, assigned_to, remarks, lead_status, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      b.lead_name, b.company_name, b.mobile, b.email,
      b.service_required, b.lead_source,
      b.estimated_value || null, b.assigned_to,
      b.remarks || null, b.lead_status,
      b.priority || 'Medium',
    ]);

    const id = info.lastInsertRowid;

    // Log creation activity
    await db.run(
      'INSERT INTO lead_activity (lead_id, action, description, actor) VALUES (?, ?, ?, ?)',
      [id, 'lead_created', `Lead created by ${actor}`, actor]
    );

    const created = await db.get('SELECT * FROM leads WHERE id = ?', [id]);
    const [withTags] = await attachTags([created]);

    res.status(201).json({
      success: true,
      data: withTags,
      warning: dup ? 'A lead with this mobile or email already existed. Both records were kept.' : undefined,
    });
  } catch (err) { next(err); }
});

// ── PUT /api/leads/:id ──────────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await db.get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!existing) throw new ApiError(404, 'Lead not found.');

    const { valid, errors } = validateLeadPayload(req.body);
    if (!valid) throw Object.assign(new ApiError(422, 'Validation failed.'), { errors });

    const b     = req.body;
    const actor = req.user?.username || 'admin';

    await db.run(`
      UPDATE leads SET
        lead_name = ?, company_name = ?, mobile = ?, email = ?,
        service_required = ?, lead_source = ?, estimated_value = ?,
        assigned_to = ?, remarks = ?, lead_status = ?, priority = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      b.lead_name, b.company_name, b.mobile, b.email,
      b.service_required, b.lead_source,
      b.estimated_value || null, b.assigned_to,
      b.remarks || null, b.lead_status,
      b.priority || existing.priority || 'Medium',
      req.params.id,
    ]);

    // Log changes
    const changes = [];
    if (existing.lead_status !== b.lead_status)
      changes.push(`Status: ${existing.lead_status} → ${b.lead_status}`);
    if (existing.assigned_to !== b.assigned_to)
      changes.push(`Assigned: ${existing.assigned_to} → ${b.assigned_to}`);
    if ((existing.priority || 'Medium') !== (b.priority || 'Medium'))
      changes.push(`Priority: ${existing.priority} → ${b.priority}`);

    const desc = changes.length ? changes.join(', ') : 'Lead details updated';
    await db.run(
      'INSERT INTO lead_activity (lead_id, action, description, actor) VALUES (?, ?, ?, ?)',
      [req.params.id, 'lead_updated', desc, actor]
    );

    const updated = await db.get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    const [withTags] = await attachTags([updated]);
    res.json({ success: true, data: withTags });
  } catch (err) { next(err); }
});

// ── DELETE /api/leads/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await db.get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!existing) throw new ApiError(404, 'Lead not found.');
    await db.run('DELETE FROM leads WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Lead deleted successfully.' });
  } catch (err) { next(err); }
});

// ── POST /api/leads/bulk ────────────────────────────────────────────────────
// Body: { action: 'delete'|'status', ids: [1,2,3], value: 'Won' }
router.post('/bulk', async (req, res, next) => {
  try {
    const { action, ids, value } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) throw new ApiError(422, 'ids array is required.');

    const actor = req.user?.username || 'admin';
    const safeIds = ids.map(Number).filter(n => !isNaN(n) && n > 0);

    if (action === 'delete') {
      // Delete one-by-one to trigger cascades (or use a single IN clause)
      const ph = safeIds.map((_, i) => `$${i + 1}`).join(',');
      await db.all(`DELETE FROM leads WHERE id IN (${ph}) RETURNING id`, safeIds);
      return res.json({ success: true, message: `${safeIds.length} lead(s) deleted.`, affected: safeIds.length });
    }

    if (action === 'status') {
      if (!value) throw new ApiError(422, 'value (new status) is required for status action.');
      const ph = safeIds.map((_, i) => `$${i + 2}`).join(',');
      await db.all(
        `UPDATE leads SET lead_status = $1, updated_at = NOW() WHERE id IN (${ph}) RETURNING id`,
        [value, ...safeIds]
      );
      // Log activity for each
      for (const id of safeIds) {
        await db.run(
          'INSERT INTO lead_activity (lead_id, action, description, actor) VALUES (?, ?, ?, ?)',
          [id, 'status_changed', `Status bulk-changed to "${value}" by ${actor}`, actor]
        );
      }
      return res.json({ success: true, message: `${safeIds.length} lead(s) updated to "${value}".`, affected: safeIds.length });
    }

    if (action === 'priority') {
      if (!value) throw new ApiError(422, 'value (new priority) is required for priority action.');
      const ph = safeIds.map((_, i) => `$${i + 2}`).join(',');
      await db.all(
        `UPDATE leads SET priority = $1, updated_at = NOW() WHERE id IN (${ph}) RETURNING id`,
        [value, ...safeIds]
      );
      return res.json({ success: true, message: `${safeIds.length} lead(s) priority set to "${value}".`, affected: safeIds.length });
    }

    if (action === 'assign') {
      if (!value) throw new ApiError(422, 'value (assignee name) is required for assign action.');
      const ph = safeIds.map((_, i) => `$${i + 2}`).join(',');
      await db.all(
        `UPDATE leads SET assigned_to = $1, updated_at = NOW() WHERE id IN (${ph}) RETURNING id`,
        [value, ...safeIds]
      );
      return res.json({ success: true, message: `${safeIds.length} lead(s) assigned to "${value}".`, affected: safeIds.length });
    }

    throw new ApiError(422, `Unknown bulk action: ${action}`);
  } catch (err) { next(err); }
});

module.exports = router;
