/* ==========================================================================
   login.js  —  Login page logic
   ========================================================================== */

// Already logged in → skip straight to app
if (getToken()) {
  window.location.href = 'index.html';
}

// Restore dark mode preference on login page (ui-utils.js is NOT loaded here)
(function () {
  const saved = localStorage.getItem('lms_dark_mode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = saved !== null ? saved === 'true' : prefersDark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();

const form      = document.getElementById('loginForm');
const alertBox  = document.getElementById('alertBox');
const loginBtn  = document.getElementById('loginBtn');
const spinner   = document.getElementById('loginSpinner');
const btnText   = document.getElementById('loginBtnText');

function showError(message) {
  alertBox.innerHTML = `<div class="alert alert-error">${message}</div>`;
}

function setLoading(loading) {
  loginBtn.disabled   = loading;
  spinner.style.display = loading ? 'inline-block' : 'none';
  btnText.textContent   = loading ? 'Signing in…' : 'Sign In';
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  alertBox.innerHTML = '';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username) { showError('Please enter your username.'); return; }
  if (!password) { showError('Please enter your password.'); return; }

  setLoading(true);

  try {
    const res = await api.login(username, password);
    setSession(res.token, res.user);
    window.location.href = 'index.html';
  } catch (err) {
    showError(err.message || 'Login failed. Please check your credentials.');
    setLoading(false);
  }
});
