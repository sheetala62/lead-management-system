// api.js
// Single place that knows how to talk to the backend.
// Change API_BASE_URL when you deploy the backend somewhere other than localhost.

const API_HOST = window.location.hostname || 'localhost';
const API_BASE_URL = window.LMS_API_BASE_URL || `http://${API_HOST}:5000/api`;

function getToken() {
  return localStorage.getItem('lms_token');
}

function setSession(token, user) {
  localStorage.setItem('lms_token', token);
  localStorage.setItem('lms_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('lms_token');
  localStorage.removeItem('lms_user');
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('lms_user'));
  } catch {
    return null;
  }
}

// Redirects to login if there's no token. Call at the top of every
// protected page's script.
function requireAuth() {
  if (!getToken()) {
    window.location.replace('login.html');
    return false;
  }
  return true;
}

async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { success: false, message: 'Server returned an unreadable response.' };
  }

  if (res.status === 401 && auth) {
    // Token missing/expired - send the user back to login.
    clearSession();
    window.location.href = 'login.html';
    return Promise.reject(data);
  }

  if (!res.ok || data.success === false) {
    return Promise.reject(data);
  }

  return data;
}

const api = {
  login: (username, password) =>
    apiRequest('/auth/login', { method: 'POST', body: { username, password }, auth: false }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  getMeta: () => apiRequest('/meta'),
  getLeads: (params) => apiRequest(`/leads?${new URLSearchParams(params).toString()}`),
  getLead: (id) => apiRequest(`/leads/${id}`),
  createLead: (payload) => apiRequest('/leads', { method: 'POST', body: payload }),
  updateLead: (id, payload) => apiRequest(`/leads/${id}`, { method: 'PUT', body: payload }),
  deleteLead: (id) => apiRequest(`/leads/${id}`, { method: 'DELETE' }),
  getFollowups: (leadId) => apiRequest(`/leads/${leadId}/followups`),
  addFollowup: (leadId, payload) => apiRequest(`/leads/${leadId}/followups`, { method: 'POST', body: payload }),
  getDashboardStats: () => apiRequest('/dashboard/stats'),
};
