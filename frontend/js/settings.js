/* ==========================================================================
   settings.js — Company Settings page (admin only)
   ========================================================================== */
requireAuth();

const el   = id => document.getElementById(id);
const user = getCurrentUser();

if (user && user.role !== 'admin') {
  el('alertBox').innerHTML =
    '<div class="alert alert-warning">Only administrators can access Settings.</div>';
}

let allSettings  = {};
let allTemplates = [];
let currentSlug  = null;

/* ── Tabs ───────────────────────────────────────────────── */
document.querySelectorAll('.settings-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = el('tab-' + btn.dataset.tab);
    if (panel) panel.classList.add('active');
    if (btn.dataset.tab === 'templates' && !allTemplates.length) loadTemplates();
    if (btn.dataset.tab === 'assignees') loadAssignees();
  });
});

/* ── Load & populate settings ───────────────────────────── */
async function loadSettings() {
  try {
    const { data } = await api.getAllSettings();
    allSettings = data;
    populateFields();
  } catch (err) {
    el('alertBox').innerHTML =
      `<div class="alert alert-warning">
        Settings API not available yet — run <strong>migration2.sql</strong> and restart the backend to enable this page.
        <br><small>${err.message || ''}</small>
      </div>`;
  }
}

function populateFields() {
  const map = {
    s_company_name:    'company_name',    s_company_tagline:   'company_tagline',
    s_company_email:   'company_email',   s_company_phone:     'company_phone',
    s_company_website: 'company_website', s_support_email:     'support_email',
    s_company_address: 'company_address',
    s_primary_color:   'primary_color',   s_accent_color:      'accent_color',
    s_company_logo_url:'company_logo_url',s_company_favicon_url:'company_favicon_url',
    s_timezone:        'timezone',        s_date_format:       'date_format',
    s_currency:        'currency',        s_currency_symbol:   'currency_symbol',
    s_smtp_host:       'smtp_host',       s_smtp_port:         'smtp_port',
    s_smtp_user:       'smtp_user',       s_smtp_pass:         'smtp_pass',
    s_smtp_from_name:  'smtp_from_name',  s_smtp_from_email:   'smtp_from_email',
    s_smtp_secure:     'smtp_secure',
    s_whatsapp_enabled:'whatsapp_enabled',s_whatsapp_api_url:  'whatsapp_api_url',
    s_whatsapp_token:  'whatsapp_token',  s_whatsapp_from:     'whatsapp_from',
    s_allow_registration:'allow_registration',
    s_require_email_verification:'require_email_verification',
    s_session_timeout_hours:'session_timeout_hours',
  };
  for (const [elId, key] of Object.entries(map)) {
    const input = el(elId);
    if (input && allSettings[key] !== undefined) input.value = allSettings[key];
  }
  const pc = el('s_primary_color_picker');
  const ac = el('s_accent_color_picker');
  if (pc && allSettings.primary_color) pc.value = allSettings.primary_color;
  if (ac && allSettings.accent_color)  ac.value = allSettings.accent_color;
}

/* Sync color picker ↔ text */
['primary', 'accent'].forEach(name => {
  const picker = el(`s_${name}_color_picker`);
  const text   = el(`s_${name}_color`);
  if (picker && text) {
    picker.addEventListener('input', () => { text.value = picker.value; });
    text.addEventListener('input',   () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(text.value)) picker.value = text.value;
    });
  }
});

/* ── Save settings ──────────────────────────────────────── */
el('saveSettingsBtn').addEventListener('click', async () => {
  const btn = el('saveSettingsBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const payload = {};
    const map = {
      company_name:'s_company_name', company_tagline:'s_company_tagline',
      company_email:'s_company_email', company_phone:'s_company_phone',
      company_website:'s_company_website', support_email:'s_support_email',
      company_address:'s_company_address',
      primary_color:'s_primary_color', accent_color:'s_accent_color',
      company_logo_url:'s_company_logo_url', company_favicon_url:'s_company_favicon_url',
      timezone:'s_timezone', date_format:'s_date_format',
      currency:'s_currency', currency_symbol:'s_currency_symbol',
      smtp_host:'s_smtp_host', smtp_port:'s_smtp_port',
      smtp_user:'s_smtp_user', smtp_pass:'s_smtp_pass',
      smtp_from_name:'s_smtp_from_name', smtp_from_email:'s_smtp_from_email',
      smtp_secure:'s_smtp_secure',
      whatsapp_enabled:'s_whatsapp_enabled', whatsapp_api_url:'s_whatsapp_api_url',
      whatsapp_token:'s_whatsapp_token', whatsapp_from:'s_whatsapp_from',
      allow_registration:'s_allow_registration',
      require_email_verification:'s_require_email_verification',
      session_timeout_hours:'s_session_timeout_hours',
    };
    for (const [key, elId] of Object.entries(map)) {
      const input = el(elId);
      if (input) payload[key] = input.value.trim();
    }
    await api.updateSettings(payload);
    allSettings = { ...allSettings, ...payload };
    showToast('Settings saved.', 'success');
  } catch (err) {
    showToast(err.message || 'Could not save settings.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Save Changes';
  }
});

/* ── Test SMTP ──────────────────────────────────────────── */
el('testSmtpBtn').addEventListener('click', () => {
  showToast('Check your server console / inbox for the test email.', 'info');
  el('smtpTestResult').textContent = 'Check server logs.';
  el('smtpTestResult').style.color = 'var(--green)';
});

/* ── Email Templates ────────────────────────────────────── */
async function loadTemplates() {
  try {
    const { data } = await api.getEmailTemplates();
    allTemplates = data;
    const sel = el('templateSelect');
    sel.innerHTML = '<option value="">— Select a template —</option>' +
      data.map(t => `<option value="${t.slug}">${t.name}</option>`).join('');
  } catch (err) {
    showToast(err.message || 'Could not load templates.', 'error');
  }
}

el('templateSelect').addEventListener('change', async () => {
  const slug = el('templateSelect').value;
  if (!slug) { el('templateEditor').style.display = 'none'; return; }
  try {
    const { data: tpl } = await api.getEmailTemplate(slug);
    currentSlug = slug;
    el('tpl_subject').value    = tpl.subject    || '';
    el('tpl_body_html').value  = tpl.body_html  || '';
    el('tpl_body_text').value  = tpl.body_text  || '';
    el('tpl_is_active').checked = tpl.is_active == 1;
    try {
      const vars = JSON.parse(tpl.variables || '[]');
      el('tplVariables').innerHTML = vars.map(v =>
        `<span class="tag-chip" style="background:var(--primary-bg);color:var(--primary);border-color:var(--primary-light);cursor:default;font-family:monospace;">{{${v}}}</span>`
      ).join('');
    } catch { el('tplVariables').innerHTML = ''; }
    el('templateEditor').style.display = 'block';
  } catch (err) { showToast(err.message || 'Could not load template.', 'error'); }
});

el('saveTemplateBtn').addEventListener('click', async () => {
  if (!currentSlug) return;
  const btn = el('saveTemplateBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await api.updateEmailTemplate(currentSlug, {
      subject:   el('tpl_subject').value,
      body_html: el('tpl_body_html').value,
      body_text: el('tpl_body_text').value,
      is_active: el('tpl_is_active').checked,
    });
    showToast('Template saved.', 'success');
  } catch (err) { showToast(err.message || 'Could not save template.', 'error'); }
  finally {
    btn.disabled = false;
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> Save Template';
  }
});

/* ── Assignees ──────────────────────────────────────────── */
async function loadAssignees() {
  try {
    const { data } = await api.getAdminAssignees();
    renderAssigneesTable(data);
  } catch (err) {
    const tbody = el('assigneesTableBody');
    if (tbody) tbody.innerHTML =
      `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px;">
        Could not load assignees — run migration2.sql to enable this feature.
      </td></tr>`;
  }
}

function renderAssigneesTable(assignees) {
  const tbody = el('assigneesTableBody');
  const empty = el('assigneesEmpty');
  if (!tbody) return;
  if (!assignees.length) {
    if (empty) empty.style.display = 'block';
    tbody.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  tbody.innerHTML = assignees.map(a => `
    <tr>
      <td style="font-weight:600;">${esc(a.name)}</td>
      <td>
        <span class="badge ${a.active ? 'badge-won' : 'badge-lost'}">
          ${a.active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td class="actions-cell">
        <button class="btn-${a.active ? 'danger' : 'secondary'} btn-sm"
                onclick="toggleAssignee(${a.id}, ${a.active}, '${esc(a.name).replace(/'/g,"\\'")}')">
          ${a.active ? 'Deactivate' : 'Reactivate'}
        </button>
      </td>
    </tr>`).join('');
}

function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

el('addAssigneeBtn').addEventListener('click', async () => {
  const name = el('newAssigneeName').value.trim();
  if (!name) { showToast('Please enter a name.', 'warning'); return; }
  try {
    await api.createAssignee(name);
    el('newAssigneeName').value = '';
    showToast(`"${name}" added.`, 'success');
    loadAssignees();
  } catch (err) { showToast(err.message || 'Could not add assignee.', 'error'); }
});

async function toggleAssignee(id, currentlyActive, name) {
  const confirmed = await showConfirm(
    currentlyActive
      ? `Deactivate "${name}"? They won't appear in new lead forms.`
      : `Reactivate "${name}"?`,
    currentlyActive ? 'Deactivate Assignee?' : 'Reactivate Assignee?'
  );
  if (!confirmed) return;
  try {
    await api.updateAssignee(id, { active: currentlyActive ? 0 : 1 });
    showToast(`"${name}" ${currentlyActive ? 'deactivated' : 'reactivated'}.`, 'success');
    loadAssignees();
  } catch (err) { showToast(err.message || 'Could not update assignee.', 'error'); }
}

/* ── Footer year ────────────────────────────────────────── */
const fyEl = document.getElementById('footerYear');
if (fyEl) fyEl.textContent = new Date().getFullYear();

/* ── Init ───────────────────────────────────────────────── */
loadSettings();
