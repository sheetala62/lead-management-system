const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { validateLeadPayload } = require('../utils/validators');

const router = express.Router();
router.use(authenticateToken);

const SORTABLE_FIELDS = {
  date: 'created_at',
  created_at: 'created_at',
  estimated_value: 'estimated_value',
  lead_name: 'lead_name',
};

// GET /api/leads?search=&status=&service=&assignedTo=&sortBy=&sortDir=&page=&limit=
router.get('/', async (req, res, next) => {
  try {
    const {
      search = '',
      status = '',
      service = '',
      assignedTo = '',
      sortBy = 'date',
      sortDir = 'desc',
      page = '1',
      limit = '10',
    } = req.query;

    const where = [];
    const params = [];

    if (search) {
      where.push('(lead_name LIKE ? OR company_name LIKE ? OR email LIKE ? OR mobile LIKE ?)');
      params.push(...Array(4).fill(`%${search}%`));
    }
    if (status) {
      where.push('lead_status = ?');
      params.push(status);
    }
    if (service) {
      where.push('service_required = ?');
      params.push(service);
    }
    if (assignedTo) {
      where.push('assigned_to = ?');
      params.push(assignedTo);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sortCol = SORTABLE_FIELDS[sortBy] || 'created_at';
    const sortDirection = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const total = (await db.get(`SELECT COUNT(*) AS c FROM leads ${whereSql}`, params)).c;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const rows = await db.all(`
      SELECT * FROM leads
      ${whereSql}
      ORDER BY ${sortCol} ${sortDirection}
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/:id
router.get('/:id', async (req, res, next) => {
  try {
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) throw new ApiError(404, 'Lead not found.');
    res.json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads
router.post('/', async (req, res, next) => {
  try {
    const { valid, errors } = validateLeadPayload(req.body);
    if (!valid) throw Object.assign(new ApiError(422, 'Validation failed.'), { errors });

    const b = req.body;

    // Basic duplicate-lead guard: same mobile OR email already exists.
    // Assumption documented in README: duplicates are flagged, not silently blocked,
    // because a returning client with a new enquiry is a valid business case.
    const dup = await db.get('SELECT id FROM leads WHERE mobile = ? OR email = ?', [b.mobile, b.email]);

    const info = await db.run(`
      INSERT INTO leads
        (lead_name, company_name, mobile, email, service_required, lead_source,
         estimated_value, assigned_to, remarks, lead_status, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      b.lead_name,
      b.company_name,
      b.mobile,
      b.email,
      b.service_required,
      b.lead_source,
      b.estimated_value || null,
      b.assigned_to,
      b.remarks || null,
      b.lead_status,
    ]);

    const created = await db.get('SELECT * FROM leads WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json({
      success: true,
      data: created,
      warning: dup ? 'A lead with this mobile or email already existed. Both records were kept.' : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/leads/:id
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await db.get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!existing) throw new ApiError(404, 'Lead not found.');

    const { valid, errors } = validateLeadPayload(req.body);
    if (!valid) throw Object.assign(new ApiError(422, 'Validation failed.'), { errors });

    const b = req.body;
    await db.run(`
      UPDATE leads SET
        lead_name = ?,
        company_name = ?,
        mobile = ?,
        email = ?,
        service_required = ?,
        lead_source = ?,
        estimated_value = ?,
        assigned_to = ?,
        remarks = ?,
        lead_status = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      b.lead_name,
      b.company_name,
      b.mobile,
      b.email,
      b.service_required,
      b.lead_source,
      b.estimated_value || null,
      b.assigned_to,
      b.remarks || null,
      b.lead_status,
      req.params.id,
    ]);

    const updated = await db.get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/leads/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await db.get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!existing) throw new ApiError(404, 'Lead not found.');

    await db.run('DELETE FROM leads WHERE id = ?', [req.params.id]); // followups cascade-delete via FK
    res.json({ success: true, message: 'Lead deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
