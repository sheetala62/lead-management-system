/**
 * settings.js — Company settings + email template management
 *
 * GET  /api/settings              get all company settings as key/value map
 * PUT  /api/settings              batch-update settings  [admin]
 * GET  /api/settings/public       public subset (company name, logo) — no auth
 *
 * GET  /api/settings/templates            list email templates  [admin]
 * GET  /api/settings/templates/:slug      get one template  [admin]
 * PUT  /api/settings/templates/:slug      update template  [admin]
 */

const express = require('express');
const db      = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { requireRole }       = require('../middleware/roleGuard');
const { ApiError }          = require('../middleware/errorHandler');

const router = express.Router();

const PUBLIC_KEYS = [
  'company_name','company_tagline','company_email','company_phone',
  'company_website','company_logo_url','company_favicon_url',
  'primary_color','accent_color','support_email','support_phone',
];

/* ── Public settings (no auth) ───────────────────────────────────────────────── */
router.get('/public', async (req, res, next) => {
  try {
    const rows = await db.all(
      `SELECT key, value FROM company_settings WHERE key = ANY($1::text[])`,
      [PUBLIC_KEYS]
    );
    const data = rows.reduce((m, r) => { m[r.key] = r.value; return m; }, {});
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/* ── All settings (authenticated) ───────────────────────────────────────────── */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const rows = await db.all('SELECT key, value FROM company_settings ORDER BY key');
    const data = rows.reduce((m, r) => { m[r.key] = r.value; return m; }, {});
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/* ── Batch update settings (admin only) ─────────────────────────────────────── */
router.put('/', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const updates = req.body; // { key: value, ... }
    if (!updates || typeof updates !== 'object') throw new ApiError(422, 'Body must be a key/value object.');

    const actor = req.user?.username || 'admin';
    for (const [key, value] of Object.entries(updates)) {
      await db.run(
        `INSERT INTO company_settings (key, value, updated_by, updated_at)
         VALUES (?, ?, ?, NOW())
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_by=EXCLUDED.updated_by, updated_at=NOW()`,
        [key, String(value ?? ''), actor]
      );
    }

    // Audit
    try {
      await db.run(
        'INSERT INTO audit_logs (actor, action, entity_type, description) VALUES (?,?,?,?)',
        [actor, 'settings_updated', 'company_settings', `${Object.keys(updates).length} setting(s) updated`]
      );
    } catch { /* non-critical */ }

    res.json({ success: true, message: `${Object.keys(updates).length} setting(s) saved.` });
  } catch (err) { next(err); }
});

/* ── Email templates ─────────────────────────────────────────────────────────── */
router.get('/templates', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM email_templates ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.get('/templates/:slug', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const tpl = await db.get('SELECT * FROM email_templates WHERE slug=?', [req.params.slug]);
    if (!tpl) throw new ApiError(404, 'Template not found.');
    res.json({ success: true, data: tpl });
  } catch (err) { next(err); }
});

router.put('/templates/:slug', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const tpl = await db.get('SELECT * FROM email_templates WHERE slug=?', [req.params.slug]);
    if (!tpl) throw new ApiError(404, 'Template not found.');

    const { subject, body_html, body_text, is_active } = req.body;
    await db.run(
      `UPDATE email_templates
       SET subject=?, body_html=?, body_text=?, is_active=?, updated_by=?, updated_at=NOW()
       WHERE slug=?`,
      [
        subject   ?? tpl.subject,
        body_html ?? tpl.body_html,
        body_text ?? tpl.body_text,
        is_active !== undefined ? (is_active ? 1 : 0) : tpl.is_active,
        req.user?.username || 'admin',
        req.params.slug,
      ]
    );

    const updated = await db.get('SELECT * FROM email_templates WHERE slug=?', [req.params.slug]);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

module.exports = router;
