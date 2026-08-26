requireAuth();

const user = getCurrentUser();
document.getElementById('userName').textContent = user ? user.username : '';
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { await api.logout(); } catch {}
  clearSession();
  window.location.href = 'login.html';
});

let meta = null;
let currentPage = 1;
const PAGE_SIZE = 10;
let debounceTimer = null;

const el = (id) => document.getElementById(id);
const statusFilter = el('statusFilter');
const serviceFilter = el('serviceFilter');
const assignedFilter = el('assignedFilter');
const searchInput = el('searchInput');
const sortBy = el('sortBy');
const sortDir = el('sortDir');

el('mobile').addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10);
});

function badgeClass(status) {
  return 'badge badge-' + status.toLowerCase().replace(/\s+/g, '-');
}

function showAlert(msg, type = 'error') {
  el('alertBox').innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  setTimeout(() => { el('alertBox').innerHTML = ''; }, 5000);
}

function fillSelect(select, options, placeholder) {
  select.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') +
    options.map(o => `<option value="${o}">${o}</option>`).join('');
}

async function loadMeta() {
  const { data } = await api.getMeta();
  meta = data;

  fillSelect(statusFilter, meta.statuses, 'All Statuses');
  fillSelect(serviceFilter, meta.services, 'All Services');
  fillSelect(assignedFilter, meta.assignees, 'All Assignees');

  fillSelect(el('service_required'), meta.services);
  fillSelect(el('lead_source'), meta.sources);
  fillSelect(el('assigned_to'), meta.assignees);
  fillSelect(el('lead_status'), meta.statuses);
}

async function loadLeads(page = 1) {
  currentPage = page;
  const params = {
    search: searchInput.value.trim(),
    status: statusFilter.value,
    service: serviceFilter.value,
    assignedTo: assignedFilter.value,
    sortBy: sortBy.value,
    sortDir: sortDir.value,
    page: String(page),
    limit: String(PAGE_SIZE),
  };
  Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });

  try {
    const { data, pagination } = await api.getLeads(params);
    renderTable(data);
    renderPagination(pagination);
  } catch (err) {
    showAlert(err.message || 'Could not load leads.');
  }
}

function renderTable(leads) {
  const tbody = el('leadsTableBody');
  el('emptyState').style.display = leads.length ? 'none' : 'block';

  tbody.innerHTML = leads.map((lead) => `
    <tr>
      <td><a href="lead-details?id=${lead.id}">${escapeHtml(lead.lead_name)}</a></td>
      <td>${escapeHtml(lead.company_name)}</td>
      <td>${escapeHtml(lead.service_required)}</td>
      <td><span class="${badgeClass(lead.lead_status)}">${lead.lead_status}</span></td>
      <td>${escapeHtml(lead.assigned_to)}</td>
      <td>${lead.estimated_value ? '₹' + Number(lead.estimated_value).toLocaleString('en-IN') : '—'}</td>
      <td>${new Date(lead.created_at).toLocaleDateString()}</td>
      <td class="actions-cell">
        <button class="btn-secondary btn-sm" onclick="openEditModal(${lead.id})">Edit</button>
        <button class="btn-danger btn-sm" onclick="deleteLead(${lead.id}, '${escapeHtml(lead.lead_name).replace(/'/g, "\\'")}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function renderPagination({ page, totalPages, total }) {
  const container = el('pagination');
  if (total === 0) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <span>Page ${page} of ${totalPages} (${total} leads)</span>
    <button class="btn-secondary btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="loadLeads(${page - 1})">Prev</button>
    <button class="btn-secondary btn-sm" ${page >= totalPages ? 'disabled' : ''} onclick="loadLeads(${page + 1})">Next</button>
  `;
}

[searchInput].forEach((input) => {
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadLeads(1), 350);
  });
});
[statusFilter, serviceFilter, assignedFilter, sortBy, sortDir].forEach((s) => {
  s.addEventListener('change', () => loadLeads(1));
});

// ---------- Modal (Add / Edit) ----------
const overlay = el('leadModalOverlay');
const form = el('leadForm');
const FIELDS = ['lead_name', 'company_name', 'mobile', 'email', 'service_required', 'lead_source', 'estimated_value', 'assigned_to', 'remarks', 'lead_status'];

function openAddModal() {
  el('modalTitle').textContent = 'Add New Lead';
  el('leadId').value = '';
  form.reset();
  clearFieldErrors();
  el('lead_status').value = 'New';
  overlay.classList.add('open');
}

async function openEditModal(id) {
  try {
    const { data: lead } = await api.getLead(id);
    el('modalTitle').textContent = 'Edit Lead';
    el('leadId').value = lead.id;
    FIELDS.forEach((f) => { el(f).value = lead[f] ?? ''; });
    clearFieldErrors();
    overlay.classList.add('open');
  } catch (err) {
    showAlert(err.message || 'Could not load lead.');
  }
}

function closeModal() {
  overlay.classList.remove('open');
}

el('openAddBtn').addEventListener('click', openAddModal);
el('cancelModalBtn').addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

function clearFieldErrors() {
  document.querySelectorAll('.field').forEach((f) => {
    f.classList.remove('has-error');
    const errEl = f.querySelector('.field-error');
    if (errEl) errEl.textContent = '';
  });
  el('modalAlert').innerHTML = '';
}

function showFieldErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const input = el(field);
    if (!input) return;
    const fieldDiv = input.closest('.field');
    fieldDiv.classList.add('has-error');
    fieldDiv.querySelector('.field-error').textContent = message;
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors();

  const payload = {};
  FIELDS.forEach((f) => {
    const v = el(f).value.trim();
    payload[f] = f === 'estimated_value' ? (v === '' ? null : Number(v)) : v;
  });

  const id = el('leadId').value;
  const saveBtn = el('saveLeadBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    if (id) {
      await api.updateLead(id, payload);
      showAlert('Lead updated successfully.', 'success');
    } else {
      await api.createLead(payload);
      showAlert('Lead created successfully.', 'success');
    }
    closeModal();
    loadLeads(currentPage);
  } catch (err) {
    if (err.errors) {
      showFieldErrors(err.errors);
      el('modalAlert').innerHTML = `<div class="alert alert-error">Please fix the highlighted fields.</div>`;
    } else {
      el('modalAlert').innerHTML = `<div class="alert alert-error">${err.message || 'Could not save lead.'}</div>`;
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Lead';
  }
});

async function deleteLead(id, name) {
  if (!confirm(`Delete lead "${name}"? This also removes its follow-up history. This cannot be undone.`)) return;
  try {
    await api.deleteLead(id);
    showAlert('Lead deleted.', 'success');
    loadLeads(currentPage);
  } catch (err) {
    showAlert(err.message || 'Could not delete lead.');
  }
}

// ---------- Init ----------
(async function init() {
  try {
    await loadMeta();
    await loadLeads(1);
  } catch (err) {
    showAlert(err.message || 'Failed to initialize page.');
  }
})();
