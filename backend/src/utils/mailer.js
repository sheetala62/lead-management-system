/**
 * mailer.js — Email sending utility.
 *
 * Uses nodemailer when SMTP credentials are configured.
 * Falls back to a console.log stub so the app works without SMTP in dev.
 *
 * Usage:
 *   const mailer = require('./mailer');
 *   await mailer.send({ to, subject, html, text });
 *   await mailer.sendTemplate('password_reset', { full_name: '...', reset_url: '...' }, 'user@email.com');
 */

let nodemailer;
try { nodemailer = require('nodemailer'); } catch { nodemailer = null; }

const db = require('../db');

/* ── Build transporter from env (lazy-created) ─────────────────────────────── */
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!nodemailer || !host || !user || !pass) return null;

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  return _transporter;
}

/* ── Replace template variables ─────────────────────────────────────────────── */
function interpolate(str, vars = {}) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/* ── Core send ───────────────────────────────────────────────────────────────── */
async function send({ to, subject, html, text, from }) {
  const fromName  = process.env.SMTP_FROM_NAME  || 'LeadMS CRM';
  const fromEmail = process.env.SMTP_FROM_EMAIL || (process.env.SMTP_USER || 'noreply@leadms.com');
  const fromAddr  = from || `"${fromName}" <${fromEmail}>`;

  const transporter = getTransporter();

  if (!transporter) {
    // Dev fallback — log to console
    console.log('\n📧 [MAILER STUB] Email not sent (no SMTP config):');
    console.log('  To     :', to);
    console.log('  From   :', fromAddr);
    console.log('  Subject:', subject);
    console.log('  Text   :', (text || '').slice(0, 200));
    console.log('');
    return { success: true, stub: true };
  }

  const info = await transporter.sendMail({
    from: fromAddr,
    to,
    subject,
    html,
    text,
  });

  console.log(`[MAILER] Sent to ${to}: ${info.messageId}`);
  return { success: true, messageId: info.messageId };
}

/* ── Template-based send ─────────────────────────────────────────────────────── */
async function sendTemplate(slug, variables = {}, to) {
  try {
    const tpl = await db.get('SELECT * FROM email_templates WHERE slug = ? AND is_active = 1', [slug]);
    if (!tpl) {
      console.warn(`[MAILER] Template "${slug}" not found or inactive.`);
      return { success: false, message: 'Template not found' };
    }

    // Merge company settings into variables
    const settings = await getSettingsMap();
    const vars = {
      company_name:  settings.company_name  || process.env.COMPANY_NAME || 'LeadMS CRM',
      support_email: settings.support_email || process.env.SUPPORT_EMAIL || '',
      app_url:       process.env.APP_URL    || process.env.FRONTEND_URL || '',
      ...variables,
    };

    return await send({
      to,
      subject:  interpolate(tpl.subject,   vars),
      html:     interpolate(tpl.body_html,  vars),
      text:     interpolate(tpl.body_text,  vars),
    });
  } catch (err) {
    console.error('[MAILER] sendTemplate error:', err.message);
    return { success: false, message: err.message };
  }
}

/* ── WhatsApp Cloud API message ──────────────────────────────────────────────── */
async function sendWhatsApp(to, message) {
  const settings = await getSettingsMap();
  const enabled  = settings.whatsapp_enabled === 'true' || process.env.WHATSAPP_ENABLED === 'true';
  if (!enabled) {
    console.log(`[WHATSAPP STUB] Would send to ${to}: ${message.slice(0,80)}`);
    return { success: true, stub: true };
  }

  const apiUrl = settings.whatsapp_api_url || process.env.WHATSAPP_API_URL;
  const token  = settings.whatsapp_token   || process.env.WHATSAPP_TOKEN;
  const from   = settings.whatsapp_from    || process.env.WHATSAPP_FROM;

  if (!apiUrl || !token) return { success: false, message: 'WhatsApp not configured' };

  // Dynamic import of fetch (Node 18+ has global fetch; older needs node-fetch)
  const fetchFn = globalThis.fetch || require('node-fetch');

  const res = await fetchFn(apiUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g,''),
      type: 'text',
      text: { body: message },
    }),
  });

  const data = await res.json();
  return { success: res.ok, data };
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
async function getSettingsMap() {
  try {
    const rows = await db.all('SELECT key, value FROM company_settings');
    return rows.reduce((m, r) => { m[r.key] = r.value; return m; }, {});
  } catch { return {}; }
}

module.exports = { send, sendTemplate, sendWhatsApp, interpolate };
