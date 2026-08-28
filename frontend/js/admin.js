/* ==========================================================================
   admin.js — Admin Panel page
   ========================================================================== */
requireAuth();

const el  = id => document.getElementById(id);
const user = getCurrentUser();

// Role guard — show warning for non-admins
if (user && user.role !== 'admin') {
  el('adminRoleAlert').innerHTML =
    '<div class="alert alert-warning" style="margin-bottom:16px;">You need <strong>Admin</strong> role to access this panel fully. Some sections may be restricted.</div>';
}

function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function relTime(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ==========================================================================
   TABS
   ========================================================================== */
document.querySelectorAll('.admin-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('tab-' + btn.dataset.tab);
    if (panel) panel.classList.add('active');
    if (btn.dataset.tab === 'login-history') loadLoginHistory();
    if (btn.dataset.tab === 'audit-logs')    loadAuditLogs();
  });
});

/* ==========================================================================
   SYSTEM STATS
   ========================================================================== */
async function loadStats() {
  try {
    const { data: d } = await api.getAdminStats();
    el('adminStatGrid').innerHTML = [
      { label:'Total Leads',      value: d.totalLeads,      iconCls:'icon-indigo', icon:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' },
      { label:'Active Users',     value: d.activeUsers + ' / ' + d.totalUsers,      iconCls:'icon-blue',   icon:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
      { label:'Leads This Month', value: d.leadsThisMonth,  iconCls:'icon-green',  icon:'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
      { label:'Logins (24h)',     value: d.loginsLast24h,   iconCls:'icon-teal',   icon:'<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>' },
    ].map(c => `
      <div class="stat-card">
        <div class="stat-card-top">
          <div class="stat-card-icon ${c.iconCls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${c.icon}</svg></div>
        </div>
        <div class="label">${c.label}</div>
        <div class="value" style="font-size:26px;">${c.value}</div>
      </div>`).join('');
  } catch (err) {
    el('adminStatGrid').innerHTML = `<div class="alert alert-error" style="grid-column:1/-1;">${esc(err.message || 'Could not load stats.')}</div>`;
  }
}

/* ==========================================================================
   STAFF TABLE
   ========================================================================== */
async function loadStaff() {
  try {
    const { data: staff } = await api.getStaff();
    renderStaffTable(staff);
  } catch (err) { showToast(err.message || 'Could not load staff.', 'error'); }
}

const ROLE_BADGE = { admin:'role-admin', manager:'role-manager', staff:'role-staff' };

function renderStaffTable(staff) {
  const tbody = el('staffTableBody');
  el('staffEmpty').style.display = staff.length ? 'none' : 'block';
  tbody.innerHTML = staff.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:50%;background:var(--brand-primary);color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${(u.full_name||u.username).charAt(0).toUpperCase()}</div>
          <div><div style="font-weight:600;color:var(--text);">${esc(u.full_name||u.username)}</div><div style="font-size:11.5px;color:var(--text-muted);">@${esc(u.username)}</div></div>
        </div>
      </td>
      <td><span class="profile-role-badge ${ROLE_BADGE[u.role]||'role-staff'}">${esc(u.role)}</span></td>
      <td style="color:var(--text-muted);font-size:12.5px;">${esc(u.email||'—')}</td>
      <td>
        <span class="flex-center" style="gap:6px;">
          <span class="status-dot ${u.is_active ? 'dot-success' : 'dot-danger'}"></span>
          ${u.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td style="font-size:12px;color:var(--text-muted);">${relTime(u.last_login)}</td>
      <td class="actions-cell">
        <button class="btn-secondary btn-sm" onclick="openEditStaff(${u.id})">Edit</button>
        <button class="btn-secondary btn-sm" onclick="openResetPwd(${u.id})">Reset Pwd</button>
        ${u.id !== ${user?.id || 0} ? `<button class="btn-danger btn-sm" onclick="deactivateStaff(${u.id},'${esc(u.username).replace(/'/g,"\\'")}','${u.is_active}')">${u.is_active ? 'Deactivate' : 'Reactivate'}</button>` : ''}
      </td>
    </tr>`).join('');
}

// ── Add Staff modal ──
el('addStaffBtn').addEventListener('click', openAddStaff);
el('staffModalClose').addEventListener('click', closeStaffModal);
el('staffModalCancel').addEventListener('click', closeStaffModal);
el('staffModalOverlay').addEventListener('click', e => { if (e.target === el('staffModalOverlay')) closeStaffModal(); });

function openAddStaff() {
  el('staffModalTitle').textContent = 'Add Staff Member';
  el('staffId').value = '';
  el('staffForm').reset();
  el('staffPasswordField').style.display = 'block';
  el('staff_username').disabled = false;
  el('staffModalAlert').innerHTML = '';
  el('staffModalOverlay').classList.add('open');
  setTimeout(() => el('staff_username').focus(), 120);
}

async function openEditStaff(id) {
  try {
    const { data: staff } = await api.getStaff();
    const u = staff.find(s => s.id === id);
    if (!u) return;
    el('staffModalTitle').textContent = 'Edit Staff Member';
    el('staffId').value         = u.id;
    el('staff_username').value  = u.username; el('staff_username').disabled = true;
    el('staff_full_name').value = u.full_name || '';
    el('staff_email').value     = u.email     || '';
    el('staff_phone').value     = u.phone     || '';
    el('staff_role').value      = u.role      || 'staff';
    el('staff_password').value  = '';
    el('staffPasswordField').style.display = 'none';
    el('staffModalAlert').innerHTML = '';
    el('staffModalOverlay').classList.add('open');
  } catch (err) { showToast(err.message || 'Could not load user.', 'error'); }
}

function closeStaffModal() { el('staffModalOverlay').classList.remove('open'); }

el('staffModalSave').addEventListener('click', async () => {
  const id       = el('staffId').value;
  const username = el('staff_username').value.trim();
  const password = el('staff_password').value;
  const full_name= el('staff_full_name').value.trim();
  const email    = el('staff_email').value.trim();
  const phone    = el('staff_phone').value.trim();
  const role     = el('staff_role').value;

  el('staffModalAlert').innerHTML = '';
  const btn = el('staffModalSave');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    if (id) {
      await api.updateStaff(id, { full_name, email, phone, role });
      showToast('Staff updated.', 'success');
    } else {
      if (!username) throw { message: 'Username is required.' };
      if (!password || password.length < 6) throw { message: 'Password must be at least 6 characters.' };
      await api.createStaff({ username, password, full_name, email, phone, role });
      showToast('Staff member added.', 'success');
    }
    closeStaffModal();
    loadStaff();
  } catch (err) {
    el('staffModalAlert').innerHTML = `<div class="alert alert-error">${esc(err.message || 'Could not save.')}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> Save';
  }
});

async function deactivateStaff(id, username, isActive) {
  const activate = isActive === 'false' || isActive === false || isActive === 0;
  const ok = await showConfirm(
    activate ? `Reactivate "${username}"?` : `Deactivate "${username}"? They will lose login access.`,
    activate ? 'Reactivate User?' : 'Deactivate User?'
  );
  if (!ok) return;
  try {
    await api.updateStaff(id, { is_active: activate ? 1 : 0 });
    showToast(`"${username}" ${activate ? 'reactivated' : 'deactivated'}.`, 'success');
    loadStaff();
  } catch (err) { showToast(err.message || 'Could not update user.', 'error'); }
}

// ── Reset password modal ──
el('resetPwdClose').addEventListener('click', () => el('resetPwdOverlay').classList.remove('open'));
el('resetPwdCancel').addEventListener('click', () => el('resetPwdOverlay').classList.remove('open'));

function openResetPwd(id) {
  el('resetPwdUserId').value = id;
  el('resetPwdInput').value  = '';
  el('resetPwdOverlay').classList.add('open');
  setTimeout(() => el('resetPwdInput').focus(), 120);
}

el('resetPwdSave').addEventListener('click', async () => {
  const id  = el('resetPwdUserId').value;
  const pwd = el('resetPwdInput').value;
  if (!pwd || pwd.length < 6) { showToast('Password must be at least 6 characters.', 'warning'); return; }
  const btn = el('resetPwdSave');
  btn.disabled = true; btn.textContent = 'Resetting…';
  try {
    await api.resetStaffPassword(id, { new_password: pwd });
    el('resetPwdOverlay').classList.remove('open');
    showToast('Password reset successfully.', 'success');
  } catch (err) { showToast(err.message || 'Could not reset password.', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Reset Password'; }
});

/* ==========================================================================
   LOGIN HISTORY
   ========================================================================== */
let loginPage = 0;
const LOGIN_LIMIT = 25;

async function loadLoginHistory(reset = true) {
  if (reset) loginPage = 0;
  const username = el('loginHistorySearch').value.trim();
  const status   = el('loginStatusFilter').value;
  try {
    const { data, total } = await api.getLoginHistory({ limit: LOGIN_LIMIT, offset: loginPage * LOGIN_LIMIT, username, status });
    renderLoginHistory(data);
    renderSimplePagination('loginPagination', total, loginPage, LOGIN_LIMIT, p => { loginPage = p; loadLoginHistory(false); });
  } catch (err) { showToast(err.message || 'Could not load login history.', 'error'); }
}

function renderLoginHistory(rows) {
  const tbody = el('loginHistoryBody');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state" style="padding:32px;text-align:center;">No login records found.</td></tr>'; return; }
  const STATUS_CLS = { success: 'dot-success', failed: 'dot-danger' };
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><div style="font-weight:600;">${esc(r.username)}</div><div style="font-size:11.5px;color:var(--text-muted);">${esc(r.full_name||'')}</div></td>
      <td><span class="flex-center" style="gap:6px;"><span class="status-dot ${STATUS_CLS[r.status]||'dot-muted'}"></span>${esc(r.status)}</span></td>
      <td style="font-size:12.5px;font-family:monospace;">${esc(r.ip_address||'—')}</td>
      <td style="font-size:11.5px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(r.user_agent)}">${esc((r.user_agent||'').slice(0,50))}</td>
      <td style="font-size:12px;color:var(--text-muted);">${relTime(r.created_at)}</td>
    </tr>`).join('');
}

let loginSearchTimer = null;
el('loginHistorySearch').addEventListener('input', () => { clearTimeout(loginSearchTimer); loginSearchTimer = setTimeout(() => loadLoginHistory(), 400); });
el('loginStatusFilter').addEventListener('change', () => loadLoginHistory());

/* ==========================================================================
   AUDIT LOGS
   ========================================================================== */
let auditPage = 0;
const AUDIT_LIMIT = 25;

async function loadAuditLogs(reset = true) {
  if (reset) auditPage = 0;
  const actor = el('auditActorSearch').value.trim();
  try {
    const { data, total } = await api.getAuditLogs({ limit: AUDIT_LIMIT, offset: auditPage * AUDIT_LIMIT, actor });
    renderAuditLogs(data);
    renderSimplePagination('auditPagination', total, auditPage, AUDIT_LIMIT, p => { auditPage = p; loadAuditLogs(false); });
  } catch (err) { showToast(err.message || 'Could not load audit logs.', 'error'); }
}

function renderAuditLogs(rows) {
  const tbody = el('auditLogsBody');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state" style="padding:32px;text-align:center;">No audit records found.</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td style="font-weight:600;">${esc(r.actor)}</td>
      <td><code style="font-size:11.5px;background:var(--surface-2);padding:2px 6px;border-radius:4px;">${esc(r.action)}</code></td>
      <td style="font-size:13px;color:var(--text-secondary);max-width:240px;">${esc(r.description)}</td>
      <td style="font-size:12px;color:var(--text-muted);">${r.entity_type ? esc(r.entity_type) + (r.entity_id ? ' #'+r.entity_id : '') : '—'}</td>
      <td style="font-size:12px;font-family:monospace;color:var(--text-muted);">${esc(r.ip_address||'—')}</td>
      <td style="font-size:12px;color:var(--text-muted);">${relTime(r.created_at)}</td>
    </tr>`).join('');
}

let auditSearchTimer = null;
el('auditActorSearch').addEventListener('input', () => { clearTimeout(auditSearchTimer); auditSearchTimer = setTimeout(() => loadAuditLogs(), 400); });

/* ==========================================================================
   SIMPLE PAGINATION
   ========================================================================== */
function renderSimplePagination(containerId, total, page, limit, onPage) {
  const container = el(containerId);
  const totalPages = Math.ceil(total / limit) || 1;
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <span class="pagination-info">Page <strong>${page+1}</strong> of <strong>${totalPages}</strong> · <strong>${total}</strong> records</span>
    <div class="pagination-controls">
      <button class="btn-secondary btn-sm" ${page<=0?'disabled':''} onclick="(${onPage.toString()})(${page-1})">← Prev</button>
      <button class="btn-secondary btn-sm" ${page>=totalPages-1?'disabled':''} onclick="(${onPage.toString()})(${page+1})">Next →</button>
    </div>`;
}

/* ---------- Escape key ---------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    el('staffModalOverlay')?.classList.remove('open');
    el('resetPwdOverlay')?.classList.remove('open');
    el('confirmOverlay')?.classList.remove('open');
  }
});

/* ---------- Footer year ---------- */
const fyEl = document.getElementById('footerYear');
if (fyEl) fyEl.textContent = new Date().getFullYear();

/* ---------- Init ---------- */
loadStats();
loadStaff();
