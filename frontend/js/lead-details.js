/* ==========================================================================
   lead-details.js  —  Lead detail page (clean, simple)
   ========================================================================== */

requireAuth();

const el     = id => document.getElementById(id);

// Read lead ID — stored in localStorage by the leads page before navigating here
// Falls back to URL param for direct bookmarked links
const leadId = localStorage.getItem('lms_current_lead_id') ||
               new URLSearchParams(window.location.search).get('id');

function esc(s)  { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function fmt(n)  { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function badgeClass(s) { return 'badge badge-' + (s || '').toLowerCase().replace(/\s+/g, '-'); }

function showAlert(msg, type = 'error') {
  el('alertBox').innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  setTimeout(() => { el('alertBox').innerHTML = ''; }, 5000);
}

/* ── Load lead info ─────────────────────────────────────── */
async function loadLead() {
  const { data: lead } = await api.getLead(leadId);

  // Breadcrumb
  const bc = el('breadcrumbLeadName');
  if (bc) bc.textContent = lead.lead_name;

  // Hero card
  el('leadHeroWrapper').innerHTML = `
    <div class="lead-hero">
      <div class="lead-hero-name">${esc(lead.lead_name)}</div>
      <div class="lead-hero-sub">
        ${esc(lead.company_name)} &nbsp;·&nbsp;
        Added ${new Date(lead.created_at).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric'
        })}
      </div>
      <div style="margin-top:10px;">
        <span class="${badgeClass(lead.lead_status)}"
              style="background:rgba(255,255,255,0.18);color:#fff;border:1px solid rgba(255,255,255,0.28);">
          ${esc(lead.lead_status)}
        </span>
      </div>
    </div>`;

  // Detail grid
  const items = [
    ['Mobile',       lead.mobile],
    ['Email',        lead.email],
    ['Service',      lead.service_required],
    ['Lead Source',  lead.lead_source],
    ['Est. Value',   lead.estimated_value ? fmt(lead.estimated_value) : '—'],
    ['Assigned To',  lead.assigned_to],
    ['Last Updated', new Date(lead.updated_at).toLocaleString('en-IN', {
      dateStyle: 'medium', timeStyle: 'short'
    })],
    ['Remarks',      lead.remarks || '—'],
  ];

  el('leadInfo').innerHTML = items.map(([label, value]) => `
    <div class="detail-item">
      <span class="label">${label}</span>
      <span class="value">${esc(String(value ?? '—'))}</span>
    </div>`).join('');
}

/* ── Follow-ups ─────────────────────────────────────────── */
function renderFollowups(followups) {
  const container = el('followupList');
  if (!followups.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:28px 16px;">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div class="empty-state-title">No follow-ups yet</div>
        <div class="empty-state-desc">Add the first one using the form above.</div>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="followup-timeline">${
    followups.map(f => `
      <div class="followup-item">
        <div class="followup-meta">
          <span class="followup-date">
            ${new Date(f.followup_date).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric'
            })}
          </span>
          <span class="followup-type-badge">${esc(f.followup_type)}</span>
          ${f.next_followup_date ? `
            <span class="followup-next">
              Next: ${new Date(f.next_followup_date).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short'
              })}
            </span>` : ''}
        </div>
        <div class="followup-remarks">${esc(f.remarks || 'No remarks.')}</div>
      </div>`).join('')
  }</div>`;
}

async function loadFollowups() {
  const { data } = await api.getFollowups(leadId);
  renderFollowups(data);
}

/* ── Add follow-up form ─────────────────────────────────── */
el('followupForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = el('addFollowupBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await api.addFollowup(leadId, {
      followup_date:      el('followup_date').value,
      followup_type:      el('followup_type').value,
      remarks:            el('followup_remarks').value.trim(),
      next_followup_date: el('next_followup_date').value || null,
    });
    el('followupForm').reset();
    el('followup_date').value = new Date().toISOString().split('T')[0];
    showToast('Follow-up added.', 'success');
    await loadFollowups();
  } catch (err) {
    showToast(err.message || 'Could not add follow-up.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
           width="13" height="13">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5"  y1="12" x2="19" y2="12"/>
      </svg>
      Add Follow-up`;
  }
});

/* ── Init ───────────────────────────────────────────────── */
async function init() {
  // Clear the stored ID now that we've captured it at the top of the file
  localStorage.removeItem('lms_current_lead_id');
  // Populate followup_type dropdown immediately with known values
  const FOLLOWUP_TYPES = ['Call', 'Email', 'WhatsApp', 'Meeting', 'Other'];
  const typeSelect = el('followup_type');
  if (typeSelect) {
    typeSelect.innerHTML = FOLLOWUP_TYPES
      .map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  }

  const dateInput = el('followup_date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  // No lead ID — show message, hide cards
  if (!leadId) {
    el('leadHeroWrapper').innerHTML = '';
    const infoCard     = el('leadInfoCard');
    const followupCard = el('followupCard');
    if (infoCard)     infoCard.style.display     = 'none';
    if (followupCard) followupCard.style.display = 'none';
    el('alertBox').innerHTML = `
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:48px;margin-bottom:16px;">🔍</div>
        <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:8px;">No lead selected</div>
        <div style="font-size:14px;color:var(--text-muted);margin-bottom:24px;">
          Please open a lead from the Leads page.
        </div>
        <a href="javascript:void(0)" onclick="window.location.href='leads.html'" class="btn-primary">← Back to Leads</a>
      </div>`;
    return;
  }

  // Override dropdown with API values if available
  try {
    const { data: metaData } = await api.getMeta();
    if (metaData.followupTypes && metaData.followupTypes.length && typeSelect) {
      typeSelect.innerHTML = metaData.followupTypes
        .map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    }
  } catch { /* hardcoded fallback already set */ }

  try {
    await loadLead();
    await loadFollowups();
  } catch (err) {
    showAlert(err.message || 'Could not load lead details.');
    showToast(err.message || 'Could not load lead details.', 'error');
  }
}

init();
