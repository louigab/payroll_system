/**
 * Shared API client for the BFAR Payroll System frontend.
 * All pages include this script to talk to the backend at http://localhost:4000/api/v1
 */

const API_BASE = 'http://localhost:4000/api/v1';

// ── Token / session helpers ─────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('bfar_token');
}

function _setToken(token) {
  localStorage.setItem('bfar_token', token);
}

function _clearSession() {
  localStorage.removeItem('bfar_token');
  localStorage.removeItem('bfar_user');
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('bfar_user') || 'null');
  } catch {
    return null;
  }
}

function _setUser(user) {
  localStorage.setItem('bfar_user', JSON.stringify(user));
}

/**
 * Redirect to login unless a valid token exists.
 * Call this at the top of every protected page.
 */
function requireAuth() {
  if (!getToken()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// ── Core fetch wrapper ──────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  Object.assign(headers, options.headers || {});

  const res = await fetch(API_BASE + path, { ...options, headers });

  if (res.status === 401) {
    _clearSession();
    window.location.href = 'login.html';
    return null;
  }

  // 204 No Content
  if (res.status === 204) return null;

  const body = await res.json();

  if (!res.ok) {
    const msg = (body && body.error && body.error.message) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return body;
}

// ── Auth ────────────────────────────────────────────────────────────────────

async function apiLogin(email, password) {
  const body = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  _setToken(body.data.accessToken);
  _setUser(body.data.user);
  return body.data;
}

async function apiLogout() {
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch (_) { /* ignore */ }
  _clearSession();
  window.location.href = 'login.html';
}

// ── Employees ───────────────────────────────────────────────────────────────

async function apiListEmployees(params = {}) {
  const qs = new URLSearchParams();
  if (params.search)       qs.set('search', params.search);
  if (params.status)       qs.set('status', params.status);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  if (params.limit)        qs.set('limit',  params.limit);
  if (params.offset)       qs.set('offset', params.offset);
  const q = qs.toString();
  const body = await apiFetch('/employees' + (q ? '?' + q : ''));
  return body ? body.data : [];
}

async function apiGetEmployee(id) {
  const body = await apiFetch('/employees/' + id);
  return body ? body.data : null;
}

async function apiCreateEmployee(data) {
  const body = await apiFetch('/employees', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return body ? body.data : null;
}

async function apiUpdateEmployee(id, data) {
  const body = await apiFetch('/employees/' + id, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return body ? body.data : null;
}

async function apiDeleteEmployee(id) {
  await apiFetch('/employees/' + id, { method: 'DELETE' });
}

// ── Attendance ──────────────────────────────────────────────────────────────

async function apiListAttendance(params = {}) {
  const qs = new URLSearchParams();
  if (params.employeeId) qs.set('employeeId', params.employeeId);
  if (params.status)     qs.set('status',     params.status);
  if (params.startDate)  qs.set('startDate',  params.startDate);
  if (params.endDate)    qs.set('endDate',    params.endDate);
  if (params.limit)      qs.set('limit',      params.limit);
  if (params.offset)     qs.set('offset',     params.offset);
  const q = qs.toString();
  const body = await apiFetch('/attendance' + (q ? '?' + q : ''));
  return body ? body.data : [];
}

async function apiCreateAttendance(data) {
  const body = await apiFetch('/attendance', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return body ? body.data : null;
}

async function apiApproveAttendance(id) {
  const body = await apiFetch('/attendance/' + id + '/approve', { method: 'PATCH' });
  return body ? body.data : null;
}

async function apiRejectAttendance(id) {
  const body = await apiFetch('/attendance/' + id + '/reject', { method: 'PATCH' });
  return body ? body.data : null;
}

// ── Payroll ─────────────────────────────────────────────────────────────────

async function apiListPayPeriods(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  const q = qs.toString();
  const body = await apiFetch('/payroll/periods' + (q ? '?' + q : ''));
  return body ? body.data : [];
}

async function apiCreatePayPeriod(data) {
  const body = await apiFetch('/payroll/periods', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return body ? body.data : null;
}

async function apiListPayrollRuns(params = {}) {
  const qs = new URLSearchParams();
  if (params.payPeriodId) qs.set('payPeriodId', params.payPeriodId);
  const q = qs.toString();
  const body = await apiFetch('/payroll/runs' + (q ? '?' + q : ''));
  return body ? body.data : [];
}

async function apiGetPayrollRun(id) {
  const body = await apiFetch('/payroll/runs/' + id);
  return body ? body.data : null;
}

async function apiCreatePayrollRun(data) {
  const idempotencyKey = data.idempotencyKey || crypto.randomUUID();
  const body = await apiFetch('/payroll/runs', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(data)
  });
  return body ? body.data : null;
}

async function apiListPayrollItems(runId) {
  const body = await apiFetch('/payroll/runs/' + runId + '/items');
  return body ? body.data : [];
}

// ── Tax ──────────────────────────────────────────────────────────────────────

async function apiListTaxRates(params = {}) {
  const qs = new URLSearchParams();
  if (params.effectiveFrom) qs.set('effectiveFrom', params.effectiveFrom);
  if (params.effectiveTo)   qs.set('effectiveTo',   params.effectiveTo);
  const q = qs.toString();
  const body = await apiFetch('/tax/rates' + (q ? '?' + q : ''));
  return body ? body.data : [];
}

async function apiCreateTaxRate(data) {
  const body = await apiFetch('/tax/rates', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return body ? body.data : null;
}
