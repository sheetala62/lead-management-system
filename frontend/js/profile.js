/* ==========================================================================
   profile.js — My Profile page
   ========================================================================== */
requireAuth();

const el = id => document.getElementById(id);

/* ---------- Helpers ---------- */
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

function pwdStrength(v) {
  const score = (v.length >= 8 ? 1 : 0) + (/[A-Z]/.test(v) ? 1 : 0) +
                (/[0-9]/.test(v) ? 1 : 0) + (/[^A-Za-z0-9]/.test(v) ? 1 : 0);
  const levels = [
    { pct: '25%', col: '#dc2626', lbl: 'Weak' },
    { pct: '50%', col: '#d97706', lbl: 'Fair' },
    { pct: '75%', col: '#3b82f6', lbl: 'Good' },
    { pct: '100%',col: '#059669', lbl: 'Strong' },
  ];
  const idx = Math.min(Math.max(score - 1, 0), 3);
  return levels[idx];
}

/* ---------- Password strength listener ---------- */
el('new_password').addEventListener('input', () => {
  const v = el('new_password').value;
  const wrap = el('pwdStrength');
  wrap.style.display = v ? 'block' : 'none';
  if (!v) return;
  const s = pwdStrength(v);
  el('pwdStrengthFill').style.width      = s.pct;
  el('pwdStrengthFill').style.background = s.col;
  el('pwdStrengthLabel').textContent     = s.lbl;
  el('pwdStrengthLabel').style.color     = s.col;
});

/* ---------- Render profile ---------- */
function renderProfile(user) {
  // Sidebar / header already handled by ui-utils
  el('profileName').textContent = user.full_name || user.username;
  el('profileUsername').textContent = '@' + user.username;

  // Avatar
  renderAvatar(user.avatar_url, user.full_name || user.username);

  // Role badge
  const roleColors = { admin: 'role-admin', manager: 'role-manager', staff: 'role-staff' };
  el('profileRoleBadge').innerHTML =
    `<span class="profile-role-badge ${roleColors[user.role] || 'role-staff'}">${esc(user.role)}</span>`;

  // Email verification status
  if (user.email) {
    if (user.email_verified) {
      el('verifiedStatus').innerHTML = `<span class="verified-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Email verified</span>`;
      el('verifyEmailCard').style.display = 'none';
    } else {
      el('verifiedStatus').innerHTML = `<span class="unverified-badge" id="triggerVerify"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Email not verified — click to verify</span>`;
      el('verifyEmailCard').style.display = 'block';
      el('triggerVerify')?.addEventListener('click', () => el('verifyEmailCard').scrollIntoView({ behavior: 'smooth' }));
    }
  }

  // Dates
  el('memberSince').textContent = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  el('lastLogin').textContent = user.last_login
    ? new Date(user.last_login).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'First time today';

  // Fill form fields
  el('full_name').value        = user.full_name  || '';
  el('profile_username').value = user.username   || '';
  el('profile_email').value    = user.email      || '';
  el('profile_phone').value    = user.phone      || '';
}

function renderAvatar(avatarUrl, name) {
  const avatarEl = el('avatarDisplay');
  if (avatarUrl && avatarUrl.startsWith('data:')) {
    avatarEl.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else if (avatarUrl && avatarUrl.startsWith('http')) {
    avatarEl.innerHTML = `<img src="${esc(avatarUrl)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    avatarEl.textContent = (name || '?').charAt(0).toUpperCase();
  }
}

/* ---------- Avatar upload ---------- */
el('avatarUploadBtn').addEventListener('click', () => el('avatarFileInput').click());

el('avatarFileInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 300000) { showToast('Image too large. Please use an image under 300 KB.', 'warning'); return; }

  const reader = new FileReader();
  reader.onload = async ev => {
    const dataUrl = ev.target.result;
    try {
      await api.updateAvatar(dataUrl);
      renderAvatar(dataUrl, el('profileName').textContent);
      // Update header avatar initial as well
      const hAvatar = document.getElementById('headerAvatar');
      const sAvatar = document.getElementById('sidebarAvatar');
      if (hAvatar) { hAvatar.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`; }
      if (sAvatar) { sAvatar.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`; }
      showToast('Profile photo updated.', 'success');
    } catch (err) { showToast(err.message || 'Could not update avatar.', 'error'); }
  };
  reader.readAsDataURL(file);
});

/* ---------- Profile form ---------- */
el('profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = el('saveProfileBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const updated = await api.updateProfile({
      full_name: el('full_name').value.trim(),
      email:     el('profile_email').value.trim(),
      phone:     el('profile_phone').value.trim(),
    });
    renderProfile(updated.data);
    showToast('Profile saved.', 'success');
  } catch (err) {
    showToast(err.message || 'Could not save profile.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Save Changes';
  }
});

/* ---------- Change password form ---------- */
el('passwordForm').addEventListener('submit', async e => {
  e.preventDefault();
  const curr = el('current_password').value;
  const nPwd = el('new_password').value;
  const cPwd = el('confirm_password').value;

  if (!curr || !nPwd || !cPwd) { showToast('All password fields are required.', 'warning'); return; }
  if (nPwd.length < 6)         { showToast('New password must be at least 6 characters.', 'warning'); return; }
  if (nPwd !== cPwd)           { showToast('Passwords do not match.', 'warning'); return; }

  const btn = el('savePasswordBtn');
  btn.disabled = true; btn.textContent = 'Updating…';
  try {
    await api.changePassword({ current_password: curr, new_password: nPwd });
    el('passwordForm').reset();
    el('pwdStrength').style.display = 'none';
    showToast('Password updated successfully.', 'success');
  } catch (err) {
    showToast(err.message || 'Could not update password.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Update Password';
  }
});

/* ---------- Resend verification ---------- */
el('resendVerifyBtn')?.addEventListener('click', async () => {
  try {
    await api.resendVerification();
    showToast('Verification email sent. Check your inbox.', 'success');
  } catch (err) {
    showToast(err.message || 'Could not send verification email.', 'error');
  }
});

/* ---------- Footer year ---------- */
const fyEl = document.getElementById('footerYear');
if (fyEl) fyEl.textContent = new Date().getFullYear();

/* ---------- Init ---------- */
(async function init() {
  try {
    const { data: user } = await api.getProfile();
    renderProfile(user);
  } catch (err) {
    showToast(err.message || 'Could not load profile.', 'error');
  }
})();

// Scroll to password section if coming from dropdown "Change Password"
if (window.location.hash === '#password') {
  document.addEventListener('DOMContentLoaded', () => {
    const pwdCard = document.getElementById('passwordForm')?.closest('.card');
    if (pwdCard) {
      setTimeout(() => {
        pwdCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('current_password')?.focus();
      }, 400);
    }
  });
}
