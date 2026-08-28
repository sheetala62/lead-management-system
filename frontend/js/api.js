// api.js — single place that knows how to talk to the backend.

const API_BASE_URL =
  window.LMS_API_BASE_URL ||
  'https://lead-management-system-1-whf8.onrender.com';

/* ---------- Session helpers ---------- */
function getToken()       { return localStorage.getItem('lms_token'); }
function setSession(t, u) { localStorage.setItem('lms_token', t); localStorage.setItem('lms_user', JSON.stringify(u)); }
function clearSession()   { localStorage.removeItem('lms_token'); localStorage.removeItem('lms_user'); }
function getCurrentUser() { try { return JSON.parse(localStorage.getItem('lms_user')); } catch { return null; } }
function requireAuth()    { if (!getToken()) { window.location.replace('login.html'); return false; } return true; }

/* ---------- Core fetch wrapper ---------- */
async function apiRequest(path, { method = 'GET', body, auth = true, rawResponse = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) { const t = getToken(); if (t) headers['Authorization'] = `Bearer ${t}`; }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (rawResponse) return res;

  let data;
  try   { data = await res.json(); }
  catch { data = { success: false, message: 'Server returned an unreadable response.' }; }

  if (res.status === 401 && auth) { clearSession(); window.location.href = 'login.html'; return Promise.reject(data); }
  if (!res.ok || data.success === false) return Promise.reject(data);
  return data;
}

/* ---------- API surface ---------- */
const api = {

  // ── Auth ──────────────────────────────────────────────────────────────────
  login:              (username, password) => apiRequest('/api/auth/login', { method: 'POST', body: { username, password }, auth: false }),
  logout:             ()                   => apiRequest('/api/auth/logout', { method: 'POST' }),
  forgotPassword:     (data)               => apiRequest('/api/auth/forgot-password', { method: 'POST', body: data, auth: false }),
  resetPassword:      (data)               => apiRequest('/api/auth/reset-password',  { method: 'POST', body: data, auth: false }),
  verifyEmail:        (token)              => apiRequest(`/api/auth/verify-email/${token}`, { auth: false }),
  resendVerification: ()                   => apiRequest('/api/auth/resend-verification', { method: 'POST' }),

  // ── Meta ──────────────────────────────────────────────────────────────────
  getMeta: () => apiRequest('/api/meta'),

  // ── Leads ─────────────────────────────────────────────────────────────────
  getLeads:       (params)      => apiRequest(`/api/leads?${new URLSearchParams(params)}`),
  getLead:        (id)          => apiRequest(`/api/leads/${id}`),
  createLead:     (payload)     => apiRequest('/api/leads', { method: 'POST', body: payload }),
  updateLead:     (id, payload) => apiRequest(`/api/leads/${id}`, { method: 'PUT', body: payload }),
  deleteLead:     (id)          => apiRequest(`/api/leads/${id}`, { method: 'DELETE' }),
  bulkLeads:      (body)        => apiRequest('/api/leads/bulk', { method: 'POST', body }),
  checkDuplicate: (params)      => apiRequest(`/api/leads/duplicate-check?${new URLSearchParams(params)}`),

  // ── Follow-ups ────────────────────────────────────────────────────────────
  getFollowups: (leadId)          => apiRequest(`/api/leads/${leadId}/followups`),
  addFollowup:  (leadId, payload) => apiRequest(`/api/leads/${leadId}/followups`, { method: 'POST', body: payload }),

  // ── Notes ─────────────────────────────────────────────────────────────────
  getNotes:   (leadId)                => apiRequest(`/api/leads/${leadId}/notes`),
  addNote:    (leadId, note)          => apiRequest(`/api/leads/${leadId}/notes`, { method: 'POST', body: { note } }),
  updateNote: (leadId, noteId, note)  => apiRequest(`/api/leads/${leadId}/notes/${noteId}`, { method: 'PATCH', body: { note } }),
  deleteNote: (leadId, noteId)        => apiRequest(`/api/leads/${leadId}/notes/${noteId}`, { method: 'DELETE' }),

  // ── Tags ──────────────────────────────────────────────────────────────────
  getAllTags:    ()                => apiRequest('/api/tags/all'),
  createTag:    (name, color)     => apiRequest('/api/tags/create', { method: 'POST', body: { name, color } }),
  getLeadTags:  (leadId)          => apiRequest(`/api/leads/${leadId}/tags`),
  addLeadTag:   (leadId, tag_id)  => apiRequest(`/api/leads/${leadId}/tags`, { method: 'POST', body: { tag_id } }),
  removeLeadTag:(leadId, tagId)   => apiRequest(`/api/leads/${leadId}/tags/${tagId}`, { method: 'DELETE' }),

  // ── Activity ──────────────────────────────────────────────────────────────
  getLeadActivity:   (leadId, params = {}) => apiRequest(`/api/leads/${leadId}/activity?${new URLSearchParams(params)}`),
  getRecentActivity: (limit = 20)          => apiRequest(`/api/activity/recent?limit=${limit}`),

  // ── Saved Filters ─────────────────────────────────────────────────────────
  getSavedFilters:   ()             => apiRequest('/api/filters'),
  saveFilter:        (name, filter) => apiRequest('/api/filters', { method: 'POST', body: { name, filter } }),
  deleteSavedFilter: (id)           => apiRequest(`/api/filters/${id}`, { method: 'DELETE' }),

  // ── Dashboard ─────────────────────────────────────────────────────────────
  getDashboardStats: () => apiRequest('/api/dashboard/stats'),

  // ── Export ────────────────────────────────────────────────────────────────
  exportCSV:     (params = {}) => apiRequest(`/api/export/csv?${new URLSearchParams(params)}`, { rawResponse: true }),
  exportPdfData: (params = {}) => apiRequest(`/api/export/pdf-data?${new URLSearchParams(params)}`),

  // ── Import ────────────────────────────────────────────────────────────────
  importCSV:         (csv) => apiRequest('/api/import/csv', { method: 'POST', body: { csv } }),
  getImportTemplate: ()    => `${API_BASE_URL}/api/import/template`,

  // ── User profile ──────────────────────────────────────────────────────────
  getProfile:     ()           => apiRequest('/api/users/me'),
  updateProfile:  (data)       => apiRequest('/api/users/me', { method: 'PUT', body: data }),
  updateAvatar:   (avatar_url) => apiRequest('/api/users/me/avatar', { method: 'PUT', body: { avatar_url } }),
  changePassword: (data)       => apiRequest('/api/users/me/password', { method: 'PUT', body: data }),

  // ── Staff management (admin) ──────────────────────────────────────────────
  getStaff:           ()          => apiRequest('/api/users'),
  createStaff:        (data)      => apiRequest('/api/users', { method: 'POST', body: data }),
  updateStaff:        (id, data)  => apiRequest(`/api/users/${id}`, { method: 'PUT', body: data }),
  deactivateStaff:    (id)        => apiRequest(`/api/users/${id}`, { method: 'DELETE' }),
  resetStaffPassword: (id, data)  => apiRequest(`/api/users/${id}/reset-password`, { method: 'POST', body: data }),

  // ── Admin panel ───────────────────────────────────────────────────────────
  getAdminStats:    ()        => apiRequest('/api/admin/stats'),
  getAuditLogs:     (params)  => apiRequest(`/api/admin/audit-logs?${new URLSearchParams(params || {})}`),
  getLoginHistory:  (params)  => apiRequest(`/api/admin/login-history?${new URLSearchParams(params || {})}`),
  getAdminAssignees:()        => apiRequest('/api/admin/assignees'),
  createAssignee:   (name)    => apiRequest('/api/admin/assignees', { method: 'POST', body: { name } }),
  updateAssignee:   (id, data)=> apiRequest(`/api/admin/assignees/${id}`, { method: 'PUT', body: data }),
  deleteAssignee:   (id)      => apiRequest(`/api/admin/assignees/${id}`, { method: 'DELETE' }),

  // ── Company settings ──────────────────────────────────────────────────────
  getPublicSettings:   ()           => apiRequest('/api/settings/public', { auth: false }),
  getAllSettings:       ()           => apiRequest('/api/settings'),
  updateSettings:      (data)       => apiRequest('/api/settings', { method: 'PUT', body: data }),
  getEmailTemplates:   ()           => apiRequest('/api/settings/templates'),
  getEmailTemplate:    (slug)       => apiRequest(`/api/settings/templates/${slug}`),
  updateEmailTemplate: (slug, data) => apiRequest(`/api/settings/templates/${slug}`, { method: 'PUT', body: data }),

};
