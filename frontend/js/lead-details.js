requireAuth();

const user = getCurrentUser();
document.getElementById('userName').textContent = user ? user.username : '';
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { await api.logout(); } catch {}
  clearSession();
  window.location.href = 'login.html';
});

const el = (id) => document.getElementById(id);
const leadId = new URLSearchParams(window.location.search).get('id');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function badgeClass(status) {
  return 'badge badge-' + status.toLowerCase().replace(/\s+/g, '-');
}

function showAlert(msg, type = 'error') {
  el('alertBox').innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  setTimeout(() => { el('alertBox').innerHTML = ''; }, 5000);
}

if (!leadId) {
  showAlert('No lead specified.');
} else {
  init();
}

async function init() {
  try {
    const { data: meta } = await api.getMeta();
    const followupTypeSelect = el('followup_type');
    followupTypeSelect.innerHTML = meta.followupTypes.map(t => `<option value="${t}">${t}</option>`).join('');

    await loadLead();
    await loadFollowups();
  } catch (err) {
    showAlert(err.message || 'Could not load lead details.');
  }
}

async function loadLead() {
  const { data: lead } = await api.getLead(leadId);

  el('leadTitle').textContent = lead.lead_name;
  el('leadSubtitle').textContent = `${lead.company_name} · Added ${new Date(lead.created_at).toLocaleDateString()}`;
  el('statusBadge').innerHTML = `<span class="${badgeClass(lead.lead_status)}">${lead.lead_status}</span>`;

  const items = [
    ['Mobile', lead.mobile],
    ['Email', lead.email],
    ['Service Required', lead.service_required],
    ['Lead Source', lead.lead_source],
    ['Estimated Value', lead.estimated_value ? '₹' + Number(lead.estimated_value).toLocaleString('en-IN') : '—'],
    ['Assigned To', lead.assigned_to],
    ['Last Updated', new Date(lead.updated_at).toLocaleString()],
    ['Remarks', lead.remarks || '—'],
  ];

  el('leadInfo').innerHTML = items.map(([label, value]) => `
    <div class="detail-item">
      <div class="label">${label}</div>
      <div class="value">${escapeHtml(String(value))}</div>
    </div>
  `).join('');
}

async function loadFollowups() {
  const { data: followups } = await api.getFollowups(leadId);
  const container = el('followupList');

  if (followups.length === 0) {
    container.innerHTML = '<p class="empty-state">No follow-ups recorded yet. Add the first one above.</p>';
    return;
  }

  container.innerHTML = followups.map((f) => `
    <div class="followup-item">
      <div class="meta">${new Date(f.followup_date).toLocaleDateString()} · ${escapeHtml(f.followup_type)}
        ${f.next_followup_date ? ` · Next follow-up: ${new Date(f.next_followup_date).toLocaleDateString()}` : ''}
      </div>
      <div>${escapeHtml(f.remarks || 'No remarks added.')}</div>
    </div>
  `).join('');
}

el('followupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = el('addFollowupBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const payload = {
    followup_date: el('followup_date').value,
    followup_type: el('followup_type').value,
    remarks: el('followup_remarks').value.trim(),
    next_followup_date: el('next_followup_date').value || null,
  };

  try {
    await api.addFollowup(leadId, payload);
    el('followupForm').reset();
    showAlert('Follow-up added.', 'success');
    await loadFollowups();
  } catch (err) {
    showAlert(err.message || 'Could not add follow-up.');
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Add Follow-up';
  }
});
