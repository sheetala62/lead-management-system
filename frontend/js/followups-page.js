/* ==========================================================================
   followups-page.js  —  Follow-ups page
   Fetches all leads and extracts follow-up records, then filters by tab.
   ========================================================================== */

requireAuth();

const el = id => document.getElementById(id);
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

let allFollowups = []; // { followup, lead }
let activeFilter = 'today';

/* ── Load all follow-ups ────────────────────────────────── */
async function loadFollowups() {
  el('fuList').innerHTML = `
    <div class="skeleton skeleton-row" style="margin-bottom:8px;"></div>
    <div class="skeleton skeleton-row" style="margin-bottom:8px;"></div>
    <div class="skeleton skeleton-row" style="margin-bottom:8px;"></div>`;

  try {
    // Fetch first 100 leads, then load follow-ups for each
    // More efficient: use the leads list and fetch followups per-lead
    // For a realistic CRM we fetch leads then get their followups
    const { data: leads } = await api.getLeads({ limit: '100', sortBy: 'date', sortDir: 'desc' });

    allFollowups = [];
    // Fetch followups for all leads in parallel (cap at 20 concurrent)
    const chunks = [];
    for (let i = 0; i < leads.length; i += 10) chunks.push(leads.slice(i, i + 10));

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(l => api.getFollowups(l.id).then(r => ({ lead: l, followups: r.data })))
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          for (const f of r.value.followups) {
            allFollowups.push({ followup: f, lead: r.value.lead });
          }
        }
      }
    }

    // Sort by followup_date desc
    allFollowups.sort((a, b) =>
      new Date(b.followup.followup_date) - new Date(a.followup.followup_date)
    );

    renderFollowups();
  } catch (err) {
    el('fuList').innerHTML =
      `<div class="alert alert-error">Could not load follow-ups: ${esc(err.message || 'Unknown error')}</div>`;
  }
}

/* ── Render ─────────────────────────────────────────────── */
function renderFollowups() {
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const filtered = allFollowups.filter(({ followup }) => {
    const d = new Date(followup.followup_date); d.setHours(0, 0, 0, 0);
    if (activeFilter === 'today')    return d.getTime() === today.getTime();
    if (activeFilter === 'upcoming') return d >= tomorrow;
    return true; // all
  });

  if (!filtered.length) {
    el('fuList').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div class="empty-state-title">No follow-ups ${activeFilter === 'today' ? 'scheduled for today' : activeFilter === 'upcoming' ? 'upcoming' : 'found'}</div>
        <div class="empty-state-desc">
          ${activeFilter === 'today'
            ? "You're all caught up for today."
            : 'Add follow-ups from a lead\'s detail page.'}
        </div>
      </div>`;
    return;
  }

  el('fuList').innerHTML = filtered.map(({ followup: f, lead: l }) => {
    const d     = new Date(f.followup_date); d.setHours(0, 0, 0, 0);
    const isToday    = d.getTime() === today.getTime();
    const isUpcoming = d >= tomorrow;
    const dotClass   = isToday ? 'today' : isUpcoming ? 'upcoming' : 'past';
    const dateLabel  = isToday
      ? '<span style="color:var(--red);font-weight:700;">Today</span>'
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    return `
      <div class="fu-card">
        <div class="fu-dot ${dotClass}"></div>
        <div class="fu-body">
          <a class="fu-lead-name" href="javascript:void(0)" onclick="localStorage.setItem('lms_current_lead_id',${l.id});window.location.href='lead-details.html'" style="cursor:pointer;">${esc(l.lead_name)}</a>
          <div class="fu-company">${esc(l.company_name)} &nbsp;·&nbsp; Assigned: ${esc(l.assigned_to)}</div>
          <div class="fu-meta">
            <span class="fu-date">${dateLabel}</span>
            <span class="fu-type">${esc(f.followup_type)}</span>
            ${f.next_followup_date
              ? `<span style="font-size:11px;color:var(--text-muted);">
                   Next: ${new Date(f.next_followup_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                 </span>`
              : ''}
          </div>
          ${f.remarks ? `<div class="fu-remarks">${esc(f.remarks)}</div>` : ''}
        </div>
        <div class="fu-action">
          <a href="javascript:void(0)" onclick="localStorage.setItem('lms_current_lead_id',${l.id});window.location.href='lead-details.html'" class="btn-secondary btn-sm">View Lead</a>
        </div>
      </div>`;
  }).join('');
}

/* ── Tab switching ──────────────────────────────────────── */
document.querySelectorAll('.fu-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fu-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderFollowups();
  });
});

/* ── Init ───────────────────────────────────────────────── */
loadFollowups();
