// If already logged in, skip straight to the app.
if (getToken()) {
  window.location.href = 'index.html';
}

const form = document.getElementById('loginForm');
const alertBox = document.getElementById('alertBox');
const loginBtn = document.getElementById('loginBtn');

function showError(message) {
  alertBox.innerHTML = `<div class="alert alert-error">${message}</div>`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.innerHTML = '';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';

  try {
    const res = await api.login(username, password);
    setSession(res.token, res.user);
    window.location.href = 'index.html';
  } catch (err) {
    showError(err.message || 'Login failed. Please check your credentials.');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
});
