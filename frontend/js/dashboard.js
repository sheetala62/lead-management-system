requireAuth();

const user = getCurrentUser();
document.getElementById('userName').textContent = user ? user.username : '';
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { await api.logout(); } catch {}
  clearSession();
  window.location.href = 'login.html';
});

function formatCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

function renderBarChart(container, dataObj, colorVar = '--accent') {
  const entries = Object.entries(dataObj);
  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-state">No data yet. Add a lead to see this chart.</p>';
    return;
  }
  const max = Math.max(...entries.map(([, v]) => v), 1);
  container.innerHTML = entries.map(([label, value]) => `
    <div class="bar-row">
      <span>${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(value / max) * 100}%; background: var(${colorVar});"></div></div>
      <span>${value}</span>
    </div>
  `).join('');
}

async function loadDashboard() {
  try {
    const { data } = await api.getDashboardStats();

    const stats = [
      { label: 'Total Leads', value: data.totalLeads, accent: true },
      { label: 'New Leads', value: data.newLeads },
      { label: 'Proposal Sent', value: data.proposalSent },
      { label: 'Won', value: data.won },
      { label: 'Lost', value: data.lost },
      { label: 'Potential Business Value', value: formatCurrency(data.potentialBusinessValue), accent: true },
    ];

    document.getElementById('statGrid').innerHTML = stats.map(s => `
      <div class="stat-card ${s.accent ? 'accent' : ''}">
        <div class="label">${s.label}</div>
        <div class="value">${s.value}</div>
      </div>
    `).join('');

    renderBarChart(document.getElementById('statusChart'), data.leadsByStatus);
    renderBarChart(document.getElementById('serviceChart'), data.leadsByService, '--accent');
  } catch (err) {
    document.getElementById('statGrid').innerHTML =
      `<div class="alert alert-error">Could not load dashboard: ${err.message || 'Unknown error'}</div>`;
  }
}

loadDashboard();
