/* ==========================================================================
   leads.js  —  Leads list page (clean, simple)
   ========================================================================== */

requireAuth();

let meta        = null;
let currentPage = 1;
const PAGE_SIZE = 10;
let debounceTimer = null;

const el = id => document.getElementById(id);

const searchInput    = el('searchInput');
const statusFilter   = el('statusFilter');
const serviceFilter  = el('serviceFilter');
const assignedFilter = el('assignedFilter');
const sortBy         = el('sortBy');
const sortDir        = el('sortDir');

/* ── Helpers ────────────────────────────────────────────── */
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function badgeClass(s) { return 'badge badge-' + (s || '').toLowerCase().replace(/\s+/g, '-'); }
function fillSelect(sel, opts, placeholder) {
  sel.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') +
    opts.map(o => `<option value="${o}">${o}</option>`).join('');
}

/* ── Mobile numeric only ────────────────────────────────── */
el('mobile').addEventListener('input', e => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
});

/* ── Load meta ──────────────────────────────────────────── */
async function loadMeta() {
  const { data } = await api.getMeta();
  meta = data;

  // Detach listeners before filling selects so fillSelect()
  // doesn't accidentally trigger change → loadLeads() multiple times
  [statusFilter, serviceFilter, assignedFilter, sortBy, sortDir].forEach(s =>
    s.removeEventListener('change', onFilterChange));

  fillSelect(statusFilter,   meta.statuses,  'All Statuses');
  fillSelect(serviceFilter,  meta.services,  'All Services');
  fillSelect(assignedFilter, meta.assignees, 'All Assignees');
  fillSelect(el('service_required'), meta.services);
  fillSelect(el('lead_source'),      meta.sources);
  fillSelect(el('assigned_to'),      meta.assignees);
  fillSelect(el('lead_status'),      meta.statuses);

  // Apply URL params AFTER selects are populated (no listeners yet so no extra loads)
  applyUrlSearch();

  // Re-attach listeners now that values are stable
  [statusFilter, serviceFilter, assignedFilter, sortBy, sortDir].forEach(s =>
    s.addEventListener('change', onFilterChange));
}

/* ── Build query params ─────────────────────────────────── */
function buildParams(page) {
  const p = {
    search:     searchInput.value.trim(),
    status:     statusFilter.value,
    service:    serviceFilter.value,
    assignedTo: assignedFilter.value,
    sortBy:     sortBy.value,
    sortDir:    sortDir.value,
    page:       String(page),
    limit:      String(PAGE_SIZE),
  };
  Object.keys(p).forEach(k => { if (!p[k]) delete p[k]; });
  return p;
}

/* ── Skeleton rows ──────────────────────────────────────── */
function renderSkeleton() {
  el('leadsTableBody').innerHTML = Array(6).fill(0).map(() => `
    <tr>
      <td><div class="skeleton skeleton-text" style="width:120px;"></div>
          <div class="skeleton skeleton-text" style="width:80px;margin-top:5px;"></div></td>
      <td><div class="skeleton skeleton-text" style="width:90px;"></div></td>
      <td><div class="skeleton skeleton-text" style="width:70px;border-radius:20px;"></div></td>
      <td><div class="skeleton skeleton-text" style="width:80px;"></div></td>
      <td><div class="skeleton skeleton-text" style="width:60px;"></div></td>
      <td><div class="skeleton skeleton-text" style="width:70px;"></div></td>
      <td><div class="skeleton skeleton-text" style="width:80px;"></div></td>
    </tr>`).join('');
  el('emptyState').style.display = 'none';
}

/* ── Load leads ─────────────────────────────────────────── */
async function loadLeads(page = 1) {
  currentPage = page;
  renderSkeleton();
  try {
    const { data, pagination } = await api.getLeads(buildParams(page));
    renderTable(data);
    renderPagination(pagination);
  } catch (err) {
    el('leadsTableBody').innerHTML = '';
    showToast(err.message || 'Could not load leads.', 'error');
  }
}

/* ── Navigate to lead detail ────────────────────────────── */
function viewLead(id) {
  localStorage.setItem('lms_current_lead_id', id);
  window.location.href = 'lead-details.html';
}

/* ── Render table ───────────────────────────────────────── */
function renderTable(leads) {
  el('emptyState').style.display = leads.length ? 'none' : 'block';
  el('leadsTableBody').innerHTML = leads.map(lead => `
    <tr>
      <td class="lead-name-cell">
        <a href="javascript:void(0)" onclick="viewLead(${lead.id})" style="cursor:pointer;">${esc(lead.lead_name)}</a>
        <div class="lead-company-sub">${esc(lead.company_name)}</div>
      </td>
      <td>${esc(lead.service_required)}</td>
      <td><span class="${badgeClass(lead.lead_status)}">${esc(lead.lead_status)}</span></td>
      <td>${esc(lead.assigned_to)}</td>
      <td>${lead.estimated_value
        ? '₹' + Number(lead.estimated_value).toLocaleString('en-IN')
        : '<span style="color:var(--text-muted);">—</span>'}</td>
      <td>${new Date(lead.created_at).toLocaleDateString()}</td>
      <td class="actions-cell">
        <button class="btn-secondary btn-sm" onclick="viewLead(${lead.id})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          View
        </button>
        <button class="btn-secondary btn-sm" onclick="openEditModal(${lead.id})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit
        </button>
        <button class="btn-danger btn-sm"
                onclick="confirmDeleteLead(${lead.id},'${esc(lead.lead_name).replace(/'/g,"\\'")}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
          Delete
        </button>
      </td>
    </tr>`).join('');
}

/* ── Pagination ─────────────────────────────────────────── */
function renderPagination({ page, totalPages, total }) {
  const c = el('pagination');
  if (!total) { c.innerHTML = ''; return; }
  c.innerHTML = `
    <span class="pagination-info">
      Page <strong>${page}</strong> of <strong>${totalPages}</strong>
      &nbsp;·&nbsp; <strong>${total}</strong> leads
    </span>
    <div class="pagination-controls">
      <button class="btn-secondary btn-sm" ${page <= 1 ? 'disabled' : ''}
              onclick="loadLeads(${page - 1})">← Prev</button>
      <button class="btn-secondary btn-sm" ${page >= totalPages ? 'disabled' : ''}
              onclick="loadLeads(${page + 1})">Next →</button>
    </div>`;
}

/* ── Filter listeners ───────────────────────────────────── */
function onFilterChange() { loadLeads(1); }

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadLeads(1), 350);
});
// Note: change listeners on selects are attached in loadMeta()
// after options are filled, to prevent spurious loads during setup.

/* ── URL search/filter pre-fill ─────────────────────────── */
function applyUrlSearch() {
  const params = new URLSearchParams(window.location.search);
  const q  = params.get('search');
  const at = params.get('assignedTo');
  if (q)  searchInput.value    = q;
  if (at) assignedFilter.value = at;
}

/* ============================================================
   MODAL — Add / Edit
   ============================================================ */
const overlay = el('leadModalOverlay');
const form    = el('leadForm');
const FIELDS  = ['lead_name', 'company_name', 'mobile', 'email',
                 'service_required', 'lead_source', 'estimated_value',
                 'assigned_to', 'remarks', 'lead_status'];

function openAddModal() {
  el('modalTitle').textContent = 'Add New Lead';
  el('leadId').value = '';
  form.reset();
  clearFieldErrors();
  if (meta) el('lead_status').value = meta.statuses[0] || '';
  overlay.classList.add('open');
  setTimeout(() => el('lead_name').focus(), 100);
}

async function openEditModal(id) {
  try {
    const { data: lead } = await api.getLead(id);
    el('modalTitle').textContent = 'Edit Lead';
    el('leadId').value = lead.id;
    FIELDS.forEach(f => { if (el(f)) el(f).value = lead[f] ?? ''; });
    clearFieldErrors();
    overlay.classList.add('open');
    setTimeout(() => el('lead_name').focus(), 100);
  } catch (err) { showToast(err.message || 'Could not load lead.', 'error'); }
}

function closeModal() { overlay.classList.remove('open'); }

el('openAddBtn').addEventListener('click', openAddModal);
el('emptyAddBtn').addEventListener('click', openAddModal);
el('cancelModalBtn').addEventListener('click', closeModal);
el('cancelModalBtnFooter').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    el('confirmOverlay')?.classList.remove('open');
  }
});

function clearFieldErrors() {
  document.querySelectorAll('#leadForm .field').forEach(f => {
    f.classList.remove('has-error');
    const err = f.querySelector('.field-error');
    if (err) err.textContent = '';
  });
  el('modalAlert').innerHTML = '';
}

function showFieldErrors(errors) {
  Object.entries(errors).forEach(([field, msg]) => {
    const inp = el(field); if (!inp) return;
    const fd  = inp.closest('.field'); if (!fd) return;
    fd.classList.add('has-error');
    const e = fd.querySelector('.field-error'); if (e) e.textContent = msg;
  });
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  clearFieldErrors();
  const payload = {};
  FIELDS.forEach(f => {
    if (!el(f)) return;
    const v = el(f).value.trim();
    payload[f] = f === 'estimated_value' ? (v === '' ? null : Number(v)) : v;
  });
  const id      = el('leadId').value;
  const saveBtn = el('saveLeadBtn');
  saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
  try {
    if (id) { await api.updateLead(id, payload); showToast('Lead updated.', 'success'); }
    else    { await api.createLead(payload);      showToast('Lead created.', 'success'); }
    closeModal();
    loadLeads(currentPage);
  } catch (err) {
    if (err.errors) {
      showFieldErrors(err.errors);
      el('modalAlert').innerHTML = '<div class="alert alert-error">Please fix the highlighted fields.</div>';
    } else {
      el('modalAlert').innerHTML =
        `<div class="alert alert-error">${esc(err.message || 'Could not save lead.')}</div>`;
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> Save Lead';
  }
});

/* ── Delete ─────────────────────────────────────────────── */
function confirmDeleteLead(id, name) {
  showConfirm(
    `"${name}" and all follow-up history will be permanently removed.`,
    'Delete this lead?'
  ).then(async ok => {
    if (!ok) return;
    try {
      await api.deleteLead(id);
      showToast('Lead deleted.', 'success');
      loadLeads(currentPage);
    } catch (err) { showToast(err.message || 'Could not delete lead.', 'error'); }
  });
}

/* ── Init ───────────────────────────────────────────────── */
(async function init() {
  try {
    await loadMeta();   // applyUrlSearch() called inside loadMeta after selects populate
    await loadLeads(1);
  } catch (err) {
    showToast(err.message || 'Failed to initialise page.', 'error');
  }
})();
