const BASE = '/api'

const DEFAULT_TIMEOUT_MS = 10_000

function getHeaders(token) {
  const h = { 'Content-Type': 'application/json' }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

export async function apiFetch(endpoint, { token, timeoutMs = DEFAULT_TIMEOUT_MS, ...options } = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let res
  try {
    res = await fetch(`${BASE}${endpoint}`, {
      ...options,
      headers: getHeaders(token),
      signal: controller.signal,
    })
  } catch (fetchErr) {
    clearTimeout(timeoutId)
    if (fetchErr.name === 'AbortError') {
      const err = new Error('Request timeout — máy chủ không phản hồi')
      err.status = 408
      throw err
    }
    throw fetchErr
  }
  clearTimeout(timeoutId)

  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    const err = new Error('Phiên đăng nhập hết hạn')
    err.status = 401
    throw err
  }

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await res.json() : null

  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

export const auth = {
  register: (body)  => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login:    (body)  => apiFetch('/auth/login',    { method: 'POST', body: JSON.stringify(body) }),
  me:       (token) => apiFetch('/auth/me', { token }),
}

export const task = {
  list:   (token)           => apiFetch('/tasks', { token }),
  create: (token, body)     => apiFetch('/tasks', { token, method: 'POST', body: JSON.stringify(body) }),
  update: (token, id, body) => apiFetch(`/tasks/${id}`, { token, method: 'PUT', body: JSON.stringify(body) }),
  delete: (token, id)       => apiFetch(`/tasks/${id}`, { token, method: 'DELETE' }),
}

export const timeEntry = {
  list: (token, date) => {
    const params = new URLSearchParams({ date })
    return apiFetch(`/time-entries?${params}`, { token })
  },
  listRange: (token, from, to) => {
    const params = new URLSearchParams({ from, to })
    return apiFetch(`/time-entries?${params}`, { token })
  },
  stats: (token, period) => {
    const params = new URLSearchParams({ period })
    return apiFetch(`/time-entries/stats?${params}`, { token })
  },
  create: (token, body)     => apiFetch('/time-entries', { token, method: 'POST', body: JSON.stringify(body) }),
  update: (token, id, body) => apiFetch(`/time-entries/${id}`, { token, method: 'PUT', body: JSON.stringify(body) }),
  delete: (token, id)       => apiFetch(`/time-entries/${id}`, { token, method: 'DELETE' }),
}

export const timer = {
  start:  (token, body) => apiFetch('/timer/start',  { token, method: 'POST', body: JSON.stringify(body) }),
  active: (token)       => apiFetch('/timer/active', { token }),
  stop:   (token)       => apiFetch('/timer/stop',   { token, method: 'POST', timeoutMs: 8_000 }),
}

export const scheduledTask = {
  list: (token, date) => {
    const params = new URLSearchParams({ date })
    return apiFetch(`/scheduled-tasks?${params}`, { token })
  },
  listRange: (token, from, to) => {
    const params = new URLSearchParams({ from, to })
    return apiFetch(`/scheduled-tasks?${params}`, { token })
  },
  create: (token, body)     => apiFetch('/scheduled-tasks', { token, method: 'POST', body: JSON.stringify(body) }),
  update: (token, id, body) => apiFetch(`/scheduled-tasks/${id}`, { token, method: 'PUT', body: JSON.stringify(body) }),
  delete: (token, id)       => apiFetch(`/scheduled-tasks/${id}`, { token, method: 'DELETE' }),
}
