/* ==========================================================================
   ui-utils.js  —  Shared UI utilities
   Toast, Confirm dialog, Dark mode, Sidebar/Header injection, Branding
   ========================================================================== */

/* ==========================================================================
   TOAST SYSTEM
   ========================================================================== */
const TOAST_ICONS = {
  success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  error:   `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:    `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};
const TOAST_TITLES = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Info' };

function showToast(message, type = 'info', title = '', duration = 4500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    ${TOAST_ICONS[type] || TOAST_ICONS.info}
    <div class="toast-content">
      <div class="toast-title">${title || TOAST_TITLES[type]}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Dismiss">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>`;
  const dismiss = () => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  container.appendChild(toast);
  if (duration > 0) setTimeout(dismiss, duration);
  return toast;
}

/* ==========================================================================
   CONFIRM DIALOG
   ========================================================================== */
function showConfirm(message, title = 'Are you sure?') {
  const overlay = document.getElementById('confirmOverlay');
  if (!overlay) return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => {
    const msgEl     = document.getElementById('confirmMessage');
    const titleEl   = overlay.querySelector('.confirm-title');
    const okBtn     = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    if (titleEl) titleEl.textContent = title;
    if (msgEl)   msgEl.textContent   = message;
    overlay.classList.add('open');
    const cleanup = (result) => {
      overlay.classList.remove('open');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onBackdrop);
      resolve(result);
    };
    const onOk       = () => cleanup(true);
    const onCancel   = () => cleanup(false);
    const onBackdrop = (e) => { if (e.target === overlay) cleanup(false); };
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onBackdrop);
  });
}

/* ==========================================================================
   DARK MODE
   ========================================================================== */
const DARK_KEY = 'lms_dark_mode';

function applyDarkMode(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const iconEl = document.getElementById('darkIcon');
  if (!iconEl) return;
  iconEl.innerHTML = dark
    ? `<circle cx="12" cy="12" r="5"/>
       <line x1="12" y1="1"  x2="12" y2="3"/>  <line x1="12" y1="21" x2="12" y2="23"/>
       <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
       <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
       <line x1="1" y1="12" x2="3" y2="12"/>   <line x1="21" y1="12" x2="23" y2="12"/>
       <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
       <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`
    : `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
}

function initDarkMode() {
  const saved = localStorage.getItem(DARK_KEY);
  const dark  = saved !== null ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyDarkMode(dark);
  const btn = document.getElementById('darkModeBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      localStorage.setItem(DARK_KEY, String(!isDark));
      applyDarkMode(!isDark);
    });
  }
}

/* ==========================================================================
   LOGOUT
   ========================================================================== */
async function doLogout() {
  try { await api.logout(); } catch {}
  clearSession();
  window.location.href = 'login.html';
}

/* ==========================================================================
   HEADER wiring (dropdowns, logout, avatar initials)
   ========================================================================== */
function initHeader() {
  const user     = getCurrentUser();
  const username = user?.username || '';
  const initial  = username ? username.charAt(0).toUpperCase() : '?';

  // Update any pre-rendered avatar / name elements
  ['sidebarAvatar','headerAvatar'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.tagName !== 'IMG') el.textContent = initial;
  });
  ['userName','headerName'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = username;
  });
  const dropLabel = document.getElementById('dropdownUserLabel');
  if (dropLabel) dropLabel.textContent = `Signed in as ${username}`;

  // Profile dropdown
  const profileBtn  = document.getElementById('profileBtn');
  const profileMenu = document.getElementById('profileMenu');
  if (profileBtn && profileMenu) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('open');
    });
    document.addEventListener('click', () => profileMenu?.classList.remove('open'));
  }

  // Logout buttons
  document.getElementById('logoutBtn')?.addEventListener('click', doLogout);
  document.getElementById('dropdownLogout')?.addEventListener('click', doLogout);
}

/* ==========================================================================
   GLOBAL HEADER SEARCH
   ========================================================================== */
function initGlobalSearch() {
  const input = document.getElementById('globalSearch');
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      window.location.href = `leads.html?search=${encodeURIComponent(input.value.trim())}`;
    }
  });
}

/* ── Mobile sidebar helpers ─────────────────────────────── */
function toggleMobMenu() {
  const sidebar  = document.getElementById('appSidebar');
  const backdrop = document.getElementById('mobSidebarOverlay');
  const isOpen   = sidebar?.classList.contains('mob-open');
  if (isOpen) { closeMobMenu(); } else { openMobMenu(); }
}
function openMobMenu() {
  document.getElementById('appSidebar')?.classList.add('mob-open');
  document.getElementById('mobSidebarOverlay')?.classList.add('visible');
  document.body.classList.add('mob-menu-open');
}
function closeMobMenu() {
  document.getElementById('appSidebar')?.classList.remove('mob-open');
  document.getElementById('mobSidebarOverlay')?.classList.remove('visible');
  document.body.classList.remove('mob-menu-open');
}

/* ==========================================================================
   DYNAMIC SIDEBAR + HEADER INJECTION
   ========================================================================== */
const SIDEBAR_NAV = [
  { href:'index.html',     label:'Dashboard',
    icon:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
  { href:'leads.html',     label:'Leads',
    icon:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { href:'employees.html', label:'Employees',
    icon:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>' },
  { href:'followups.html', label:'Follow-ups',
    icon:'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
];

function initSidebar() {
  const sidebar = document.getElementById('appSidebar');
  if (!sidebar) return;

  const user    = getCurrentUser();
  const role    = user?.role || 'staff';
  const curPage = window.location.pathname.split('/').pop() || 'index.html';
  const initial = (user?.username || '?').charAt(0).toUpperCase();
  const uname   = user?.username || '';

  const navLinks = SIDEBAR_NAV
    .filter(n => !n.adminOnly || role === 'admin')
    .map(n => {
      const active = curPage === n.href;
      return `<a href="${n.href}" class="${active ? 'active' : ''}">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${n.icon}</svg>
        <span class="nav-label">${n.label}</span>
      </a>`;
    }).join('');

  /* ── Sidebar HTML ──────────────────────────────────────── */
  sidebar.innerHTML = `
    <a href="index.html" class="brand">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <span class="brand-text">Lead<span>MS</span></span>
    </a>
    <div class="nav-section-label">Main Menu</div>
    <nav>${navLinks}</nav>
    <div class="user-box">
      <div class="user-box-inner">
        <div class="user-avatar" id="sidebarAvatar">${initial}</div>
        <div class="user-info">
          <div class="user-name" id="userName">${uname}</div>
          <div class="user-role">${role.charAt(0).toUpperCase() + role.slice(1)}</div>
        </div>
        <button class="logout-btn-sidebar" id="logoutBtn" title="Sign out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </div>`;

  /* ── Top header HTML ───────────────────────────────────── */
  const headerEl = document.getElementById('appHeader');
  if (headerEl) {
    headerEl.innerHTML = `
      <button class="mob-menu-btn" id="mobMenuBtn" aria-label="Open menu" title="Menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
          <line x1="3" y1="6"  x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <div class="header-search">
        <svg class="header-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" placeholder="Search leads…" id="globalSearch" autocomplete="off">
      </div>
      <div class="header-actions">
        <button class="icon-btn" id="darkModeBtn" title="Toggle dark mode">
          <svg id="darkIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
        <div class="header-divider"></div>
        <button class="header-profile" id="profileBtn" type="button">
          <div class="h-avatar">${initial}</div>
          <span class="h-name">${uname}</span>
          <svg class="h-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>`;

    /* ── Mobile sidebar overlay backdrop ── */
    if (!document.getElementById('mobSidebarOverlay')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'mobSidebarOverlay';
      backdrop.className = 'mob-sidebar-overlay';
      backdrop.addEventListener('click', closeMobMenu);
      document.body.appendChild(backdrop);
    }

    /* ── Hamburger toggle ── */
    document.getElementById('mobMenuBtn')?.addEventListener('click', e => {
      e.stopPropagation();
      toggleMobMenu();
    });
    // Close when a nav link is tapped
    sidebar.querySelectorAll('nav a').forEach(a => {
      a.addEventListener('click', closeMobMenu);
    });

    /* ── Dropdown appended to BODY so sticky/overflow can't clip it ── */
    // Remove any existing dropdown
    document.getElementById('headerDropdownMenu')?.remove();

    const ddEl = document.createElement('div');
    ddEl.id = 'headerDropdownMenu';
    ddEl.className = 'hdd-menu';
    ddEl.innerHTML = `
      <div class="hdd-label">Signed in as <strong>${uname}</strong></div>
      <div class="hdd-divider"></div>
      <button class="hdd-item hdd-danger" id="headerLogoutBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Logout
      </button>`;
    document.body.appendChild(ddEl);

    /* ── Toggle dropdown, position under the button ── */
    const profileBtn = document.getElementById('profileBtn');
    profileBtn.addEventListener('click', e => {
      e.stopPropagation();
      const open = ddEl.classList.contains('hdd-open');
      if (open) {
        ddEl.classList.remove('hdd-open');
      } else {
        const rect = profileBtn.getBoundingClientRect();
        ddEl.style.top  = (rect.bottom + 6) + 'px';
        ddEl.style.right = (window.innerWidth - rect.right) + 'px';
        ddEl.classList.add('hdd-open');
      }
    });

    /* ── Close on outside click ── */
    document.addEventListener('click', () => ddEl.classList.remove('hdd-open'));

    /* ── Navigate on item click ── */
    ddEl.querySelectorAll('.hdd-item[data-href]').forEach(btn => {
      btn.addEventListener('click', () => {
        ddEl.classList.remove('hdd-open');
        window.location.href = btn.dataset.href;
      });
    });

    /* ── Logout ── */
    document.getElementById('headerLogoutBtn').addEventListener('click', doLogout);

    /* Re-wire after injecting new DOM */
    initDarkMode();
    initGlobalSearch();
    initHeader();
  } else {
    document.getElementById('logoutBtn')?.addEventListener('click', doLogout);
  }
}

/* ==========================================================================
   APP FOOTER INJECTION
   ========================================================================== */
function injectAppFooter() {
  const wrapper = document.querySelector('.main-wrapper');
  if (!wrapper || wrapper.querySelector('.app-footer')) return;
  const footer = document.createElement('footer');
  footer.className = 'app-footer';
  footer.innerHTML = `&copy; ${new Date().getFullYear()} LeadMS &mdash; Lead Management System`;
  wrapper.appendChild(footer);
}

/* ==========================================================================
   PUBLIC BRANDING  (non-blocking, cached in sessionStorage)
   ========================================================================== */
function loadPublicBranding() {
  // Use cached value instantly — don't await a network call on page load
  try {
    const cached = sessionStorage.getItem('lms_branding');
    if (cached) { applyBranding(JSON.parse(cached)); }
  } catch {}

  // Refresh cache in background (won't block render)
  setTimeout(async () => {
    try {
      const base = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : '';
      if (!base) return;
      const res = await fetch(`${base}/api/settings/public`).catch(() => null);
      if (!res || !res.ok) return;
      const json = await res.json().catch(() => null);
      if (json?.data) {
        sessionStorage.setItem('lms_branding', JSON.stringify(json.data));
        applyBranding(json.data);
      }
    } catch {}
  }, 500);
}

function applyBranding(data) {
  if (!data) return;
  const root = document.documentElement;
  if (data.primary_color && /^#[0-9A-Fa-f]{6}$/.test(data.primary_color))
    root.style.setProperty('--brand-primary', data.primary_color);
  if (data.accent_color  && /^#[0-9A-Fa-f]{6}$/.test(data.accent_color))
    root.style.setProperty('--accent', data.accent_color);
}

/* ==========================================================================
   BOOTSTRAP  — runs on every app page
   (defined after all helpers so hoisting is not required)
   ========================================================================== */
(function bootstrap() {
  initDarkMode();     // apply dark/light immediately — no flicker
  initSidebar();      // inject sidebar + header HTML
  initHeader();       // wire logout / dropdown buttons
  initGlobalSearch();
  injectAppFooter();
  // loadPublicBranding() — skipped on page load to keep things fast
})();
