const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { validateLeadPayload, STATUSES, SERVICES, SOURCES, PRIORITIES } = require('../utils/validators');

const router = express.Router();
router.use(authenticateToken);

// ── POST /api/import/csv ──────────────────────────────────────────────────────
// Body: { csv: "<raw csv string>" }
// Accepts the same column order as the export endpoint.
// Returns: { inserted, skipped, errors[] }
router.post('/csv', async (req, res, next) => {
  try {
    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') {
      return res.status(422).json({ success: false, message: 'csv string is required in body.' });
    }

    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return res.status(422).json({ success: false, message: 'CSV must have at least one data row.' });
    }

    // Parse header row and build column-index map (case-insensitive)
    const rawHeaders = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim().replace(/\s+/g, '_'));
    const col = (name) => rawHeaders.indexOf(name);

    const actor   = req.user?.username || 'admin';
    let inserted  = 0;
    let skipped   = 0;
    const errors  = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (cells.every(c => !c.trim())) continue;   // blank row

      const get = (name, fallback = '') => {
        const idx = col(name);
        return idx >= 0 ? (cells[idx] || '').trim() : fallback;
      };

      const lead_name       = get('lead_name') || get('name');
      const company_name    = get('company_name') || get('company');
      const mobile          = get('mobile');
      const email           = get('email');
      const service_required= normalise(get('service_required') || get('service'), SERVICES, 'Other');
      const lead_source     = normalise(get('lead_source') || get('source'), SOURCES, 'Other');
      const lead_status     = normalise(get('lead_status') || get('status'), STATUSES, 'New');
      const priority        = normalise(get('priority'), PRIORITIES, 'Medium');
      const assigned_to     = get('assigned_to') || get('assignee') || 'Unassigned';
      const estimated_value = parseFloat(get('estimated_value') || get('value') || '') || null;
      const remarks         = get('remarks') || get('notes') || null;

      const payload = { lead_name, company_name, mobile, email, service_required, lead_source, lead_status, priority, assigned_to };
      const { valid, errors: valErrors } = validateLeadPayload(payload);

      if (!valid) {
        errors.push({ row: i + 1, lead_name: lead_name || '(blank)', errors: valErrors });
        skipped++;
        continue;
      }

      try {
        const info = await db.run(`
          INSERT INTO leads
            (lead_name, company_name, mobile, email, service_required, lead_source,
             estimated_value, assigned_to, remarks, lead_status, priority, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [lead_name, company_name, mobile, email, service_required, lead_source,
            estimated_value, assigned_to, remarks, lead_status, priority]);

        await db.run(
          'INSERT INTO lead_activity (lead_id, action, description, actor) VALUES (?, ?, ?, ?)',
          [info.lastInsertRowid, 'lead_created', `Imported via CSV by ${actor}`, actor]
        );
        inserted++;
      } catch (dbErr) {
        errors.push({ row: i + 1, lead_name, error: dbErr.message });
        skipped++;
      }
    }

    res.json({ success: true, inserted, skipped, errors });
  } catch (err) { next(err); }
});

// ── GET /api/import/template ──────────────────────────────────────────────────
// Returns a blank CSV template the user can fill in
router.get('/template', (req, res) => {
  const headers = [
    'lead_name', 'company_name', 'mobile', 'email',
    'service_required', 'lead_source', 'lead_status', 'priority',
    'assigned_to', 'estimated_value', 'remarks',
  ];
  const example = [
    'John Smith', 'Acme Corp', '9876543210', 'john@acme.com',
    'Website Development', 'Referral', 'New', 'High',
    'Rahul Sharma', '50000', 'Interested in e-commerce site',
  ];
  const csv = [headers.join(','), example.join(',')].join('\r\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="import_template.csv"');
  res.send(csv);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQ  = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function normalise(val, list, fallback) {
  if (!val) return fallback;
  const found = list.find(v => v.toLowerCase() === val.toLowerCase());
  return found || fallback;
}

module.exports = router;
