/* ==========================================================================
   employees.js  —  Employee (Assignee) management
   Uses the existing /api/admin/assignees endpoint
   ========================================================================== */

requireAuth();

const el = id => document.getElementById(id);
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

let editingId = null;

/* ── Load employees ─────────────────────────────────────── */
async function loadEmployees() {
  try {
    const { data } = await api.getAdminAssignees();
    renderTable(data);
  } catch (err) {
    // Fallback: try meta endpoint which always works
    try {
      const { data: meta } = await api.getMeta();
      const fakeRows = meta.assignees.map((name, i) => ({ id: i + 1, name, active: 1 }));
      renderTable(fakeRows, true);
    } catch {
      el('empTableBody').innerHTML =
        '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted);">Could not load employees.</td></tr>';
    }
  }
}

function renderTable(employees, readOnly = false) {
  const tbody = el('empTableBody');
  const empty = el('empEmpty');

  if (!employees.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = employees.map((e, i) => `
    <tr>
      <td style="color:var(--text-muted);font-weight:600;">${i + 1}</td>
      <td style="font-weight:600;color:var(--text);">${esc(e.name)}</td>
      <td>
        <span class="badge ${e.active ? 'badge-won' : 'badge-lost'}">
          ${e.active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <a href="leads.html?assignedTo=${encodeURIComponent(e.name)}"
           style="font-size:12.5px;color:var(--primary);">
          View leads →
        </a>
      </td>
      <td class="actions-cell">
        ${!readOnly ? `
        <button class="btn-secondary btn-sm" onclick="openEdit(${e.id}, '${esc(e.name).replace(/'/g,"\\'")}')">
          Edit
        </button>
        <button class="btn-${e.active ? 'danger' : 'secondary'} btn-sm"
                onclick="toggleEmployee(${e.id}, ${e.active}, '${esc(e.name).replace(/'/g,"\\'")}')">
          ${e.active ? 'Deactivate' : 'Activate'}
        </button>` : '<span style="font-size:12px;color:var(--text-muted);">Read only</span>'}
      </td>
    </tr>`).join('');
}

/* ── Modal ──────────────────────────────────────────────── */
function openAdd() {
  editingId = null;
  el('empModalTitle').textContent = 'Add Employee';
  el('empName').value = '';
  el('empModalAlert').innerHTML = '';
  el('empModal').classList.add('open');
  setTimeout(() => el('empName').focus(), 100);
}

function openEdit(id, name) {
  editingId = id;
  el('empModalTitle').textContent = 'Edit Employee';
  el('empName').value = name;
  el('empModalAlert').innerHTML = '';
  el('empModal').classList.add('open');
  setTimeout(() => el('empName').focus(), 100);
}

function closeModal() { el('empModal').classList.remove('open'); }

el('addEmpBtn').addEventListener('click', openAdd);
el('emptyAddEmpBtn').addEventListener('click', openAdd);
el('empModalClose').addEventListener('click', closeModal);
el('empModalCancel').addEventListener('click', closeModal);
el('empModal').addEventListener('click', e => { if (e.target === el('empModal')) closeModal(); });

el('empModalSave').addEventListener('click', async () => {
  const name = el('empName').value.trim();
  if (!name) {
    el('empModalAlert').innerHTML = '<div class="alert alert-error">Name is required.</div>';
    return;
  }
  const btn = el('empModalSave');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    if (editingId) {
      await api.updateAssignee(editingId, { name });
      showToast('Employee updated.', 'success');
    } else {
      await api.createAssignee(name);
      showToast('Employee added.', 'success');
    }
    closeModal();
    loadEmployees();
  } catch (err) {
    el('empModalAlert').innerHTML =
      `<div class="alert alert-error">${esc(err.message || 'Could not save.')}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> Save';
  }
});

/* ── Toggle active ──────────────────────────────────────── */
async function toggleEmployee(id, currentlyActive, name) {
  const action = currentlyActive ? 'Deactivate' : 'Activate';
  const ok = await showConfirm(
    currentlyActive
      ? `Deactivate "${name}"? They won't appear in new lead forms.`
      : `Activate "${name}"? They will appear in lead assignment dropdowns again.`,
    `${action} Employee?`
  );
  if (!ok) return;
  try {
    await api.updateAssignee(id, { active: currentlyActive ? 0 : 1 });
    showToast(`"${name}" ${currentlyActive ? 'deactivated' : 'activated'}.`, 'success');
    loadEmployees();
  } catch (err) {
    showToast(err.message || 'Could not update employee.', 'error');
  }
}

/* ── Escape key ─────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    el('confirmOverlay')?.classList.remove('open');
  }
});

/* ── Init ───────────────────────────────────────────────── */
loadEmployees();
