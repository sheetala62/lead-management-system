/* ==========================================================================
   dashboard.js  —  Dashboard
   Matches assessment: Total Leads, New Leads, Proposal Sent, Won, Lost,
   Potential Business Value + chart of leads by status.
   ========================================================================== */

requireAuth();

function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function badgeClass(s) { return 'badge badge-' + (s || '').toLowerCase().replace(/\s+/g, '-'); }

const BAR_COLORS = {
  'New':           '#4f46e5',
  'Contacted':     '#7c3aed',
  'Proposal Sent': '#d97706',
  'Negotiation':   '#f97316',
  'Won':           '#059669',
  'Lost':          '#dc2626',
};

/* ── Skeletons ──────────────────────────────────────────── */
function showSkeletons() {
  document.getElementById('statGrid').innerHTML = Array(6).fill(
    '<div class="skeleton skeleton-stat"></div>'
  ).join('');
}

/* ── 6 Stat cards (exactly per assessment spec) ─────────── */
function renderStatCards(d) {
  const total        = Number(d.totalLeads             || 0);
  const newLeads     = Number(d.newLeads               || 0);
  const proposalSent = Number(d.proposalSent           || (d.leadsByStatus && d.leadsByStatus['Proposal Sent']) || 0);
  const won          = Number(d.won                    || 0);
  const lost         = Number(d.lost                   || 0);
  const pipeline     = Number(d.potentialBusinessValue || 0);

  const cards = [
    {
      label: 'Total Leads', value: total, cls: '',
      iconCls: 'icon-indigo', footer: 'All enquiries recorded',
      icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    },
    {
      label: 'New Leads', value: newLeads, cls: 'val-brand',
      iconCls: 'icon-blue', footer: 'Awaiting first contact',
      icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
    },
    {
      label: 'Proposal Sent', value: proposalSent, cls: '',
      iconCls: 'icon-orange', footer: 'Proposals in review',
      icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    },
    {
      label: 'Won', value: won, cls: 'val-success',
      iconCls: 'icon-green', footer: fmt(d.wonValue || 0) + ' revenue',
      icon: '<polyline points="20 6 9 17 4 12"/>',
    },
    {
      label: 'Lost', value: lost, cls: 'val-danger',
      iconCls: 'icon-red', footer: 'Not converted',
      icon: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    },
    {
      label: 'Potential Business Value', value: fmt(pipeline), cls: 'val-brand',
      iconCls: 'icon-teal', footer: 'Active pipeline (excl. Won/Lost)',
      small: true,
      icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    },
  ];

  document.getElementById('statGrid').innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="stat-card-top">
        <div class="stat-card-icon ${c.iconCls}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">${c.icon}</svg>
        </div>
      </div>
      <div class="label">${c.label}</div>
      <div class="value ${c.cls}"${c.small ? ' style="font-size:20px;"' : ''}>${c.value}</div>
      <div class="stat-card-footer">${c.footer}</div>
    </div>`).join('');
}

/* ── Leads by Status chart ──────────────────────────────── */
function renderStatusChart(byStatus) {
  const container = document.getElementById('statusChart');
  if (!container) return;

  const entries = Object.entries(byStatus || {});
  if (!entries.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:24px 16px;">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6"  y1="20" x2="6"  y2="14"/>
          </svg>
        </div>
        <div class="empty-state-title">No data yet</div>
        <div class="empty-state-desc">Add leads to see the chart.</div>
      </div>`;
    return;
  }

  const max = Math.max(...entries.map(([, v]) => Number(v)), 1);
  const order = ['New', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
  const sorted = order
    .filter(k => byStatus[k] !== undefined)
    .map(k => [k, byStatus[k]])
    .concat(entries.filter(([k]) => !order.includes(k)));

  container.innerHTML = `<div class="bar-chart">${
    sorted.map(([label, value]) => {
      const color = BAR_COLORS[label] || '#6366f1';
      return `
        <div class="bar-row">
          <span class="bar-label" title="${esc(label)}">${esc(label)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${(Number(value) / max) * 100}%;background:${color};"></div>
          </div>
          <span class="bar-count">${value}</span>
        </div>`;
    }).join('')
  }</div>`;
}

/* ── Recent Leads ───────────────────────────────────────── */
async function loadRecentLeads() {
  const container = document.getElementById('recentLeadsBody');
  if (!container) return;
  try {
    const { data } = await api.getLeads({ limit: '5', sortBy: 'date', sortDir: 'desc' });
    if (!data.length) {
      container.innerHTML = `
        <tr><td colspan="5">
          <div class="empty-state" style="padding:24px;">
            <div class="empty-state-title">No leads yet</div>
            <div class="empty-state-desc">Go to the Leads page to add your first lead.</div>
          </div>
        </td></tr>`;
      return;
    }
    container.innerHTML = data.map(l => `
      <tr>
        <td class="lead-name-cell">
          <a href="javascript:void(0)" onclick="localStorage.setItem('lms_current_lead_id',${l.id});window.location.href='lead-details.html'" style="cursor:pointer;">${esc(l.lead_name)}</a>
          <div class="lead-company-sub">${esc(l.company_name)}</div>
        </td>
        <td>${esc(l.assigned_to)}</td>
        <td><span class="${badgeClass(l.lead_status)}">${esc(l.lead_status)}</span></td>
        <td>${l.estimated_value
          ? '₹' + Number(l.estimated_value).toLocaleString('en-IN')
          : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>${new Date(l.created_at).toLocaleDateString()}</td>
      </tr>`).join('');
  } catch {
    container.innerHTML =
      '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">Could not load recent leads.</td></tr>';
  }
}

/* ── Main load ───────────────────────────────────────────── */
async function loadDashboard() {
  showSkeletons();
  try {
    const { data: d } = await api.getDashboardStats();

    // Safe defaults
    d.totalLeads             = Number(d.totalLeads             || 0);
    d.newLeads               = Number(d.newLeads               || 0);
    d.proposalSent           = Number(d.proposalSent           || (d.leadsByStatus && d.leadsByStatus['Proposal Sent']) || 0);
    d.won                    = Number(d.won                    || 0);
    d.lost                   = Number(d.lost                   || 0);
    d.wonValue               = Number(d.wonValue               || 0);
    d.potentialBusinessValue = Number(d.potentialBusinessValue || 0);
    d.leadsByStatus          = d.leadsByStatus  || {};

    renderStatCards(d);
    renderStatusChart(d.leadsByStatus);

  } catch (err) {
    document.getElementById('statGrid').innerHTML =
      `<div class="alert alert-error" style="grid-column:1/-1;">
         Could not load dashboard: ${esc(err.message || 'Unknown error')}
       </div>`;
  }

  loadRecentLeads();
}

loadDashboard();
