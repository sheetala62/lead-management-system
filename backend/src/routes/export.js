const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildFilterWhere(query) {
  const { search = '', status = '', service = '', assignedTo = '', priority = '',
          dateFrom = '', dateTo = '', valueMin = '', valueMax = '', tag = '' } = query;

  const where  = [];
  const params = [];

  if (search) {
    where.push('(lead_name ILIKE ? OR company_name ILIKE ? OR email ILIKE ? OR mobile ILIKE ?)');
    params.push(...Array(4).fill(`%${search}%`));
  }
  if (status)     { where.push('lead_status = ?');      params.push(status); }
  if (service)    { where.push('service_required = ?'); params.push(service); }
  if (assignedTo) { where.push('assigned_to = ?');      params.push(assignedTo); }
  if (priority)   { where.push('priority = ?');         params.push(priority); }
  if (dateFrom)   { where.push('created_at >= ?');      params.push(dateFrom); }
  if (dateTo)     { where.push('created_at <= ?');      params.push(dateTo + ' 23:59:59'); }
  if (valueMin)   { where.push('estimated_value >= ?'); params.push(Number(valueMin)); }
  if (valueMax)   { where.push('estimated_value <= ?'); params.push(Number(valueMax)); }
  if (tag) {
    where.push(`id IN (SELECT lt.lead_id FROM lead_tags lt JOIN tags t ON t.id = lt.tag_id WHERE t.name = ?)`);
    params.push(tag);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// ── GET /api/export/csv ───────────────────────────────────────────────────────
router.get('/csv', async (req, res, next) => {
  try {
    const { whereSql, params } = buildFilterWhere(req.query);
    const rows = await db.all(
      `SELECT id, lead_name, company_name, mobile, email, service_required,
              lead_source, estimated_value, assigned_to, lead_status, priority,
              remarks, created_at, updated_at
       FROM leads ${whereSql} ORDER BY created_at DESC`,
      params
    );

    const HEADERS = [
      'ID', 'Lead Name', 'Company', 'Mobile', 'Email', 'Service',
      'Source', 'Est. Value', 'Assigned To', 'Status', 'Priority',
      'Remarks', 'Created At', 'Updated At',
    ];

    const csvLines = [
      HEADERS.join(','),
      ...rows.map(r => [
        r.id, r.lead_name, r.company_name, r.mobile, r.email,
        r.service_required, r.lead_source,
        r.estimated_value ?? '', r.assigned_to, r.lead_status, r.priority || 'Medium',
        r.remarks ?? '',
        new Date(r.created_at).toISOString(),
        new Date(r.updated_at).toISOString(),
      ].map(escapeCSV).join(',')),
    ];

    const csv = csvLines.join('\r\n');
    const filename = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);   // UTF-8 BOM for Excel compatibility
  } catch (err) { next(err); }
});

// ── GET /api/export/pdf-data ──────────────────────────────────────────────────
// Returns JSON for client-side PDF generation (no server-side PDF lib needed)
router.get('/pdf-data', async (req, res, next) => {
  try {
    const { whereSql, params } = buildFilterWhere(req.query);
    const rows = await db.all(
      `SELECT id, lead_name, company_name, mobile, email, service_required,
              lead_source, estimated_value, assigned_to, lead_status, priority,
              remarks, created_at
       FROM leads ${whereSql} ORDER BY created_at DESC LIMIT 500`,
      params
    );
    const stats = await db.get('SELECT COUNT(*) AS total, COALESCE(SUM(estimated_value),0) AS value FROM leads');
    res.json({ success: true, data: rows, meta: { total: stats.total, value: stats.value, generatedAt: new Date().toISOString() } });
  } catch (err) { next(err); }
});

module.exports = router;
