/*
 * TẬP TIN: api.js
 *
 * Chứa các hàm để gọi API (giao tiếp với server).
 *
 * "API" là giao diện giúp frontend (giao diện) nói chuyện với backend (server).
 * Chúng ta dùng hàm `fetch()` có sẵn trong trình duyệt để gửi HTTP request.
 *
 * Cấu trúc:
 * - apiFetch: hàm chung để gọi bất kỳ API nào
 * - auth: các hàm liên quan đến đăng nhập/đăng ký
 * - task: các hàm liên quan đến công việc
 * - timeEntry: các hàm liên quan đến bản ghi thời gian
 * - scheduledTask: các hàm liên quan đến lịch hẹn
 */

const BASE = '/api'

// Timeout mặc định cho mọi request (ms).
// Timer stop đặc biệt nhạy cảm: nếu treo quá lâu user không biết state nào là đúng.
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Tạo header cho request.
 */
function getHeaders(token) {
  const h = { 'Content-Type': 'application/json' }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

/**
 * Hàm chung để gọi API.
 *
 * Thay đổi so với bản cũ:
 * - #28: throw Error thực sự (có .stack, .status) thay vì plain object {}
 * - #29: AbortController timeout — mặc định 10 giây
 * - Dùng URLSearchParams cho query params thay vì string interpolation
 *
 * @param {string} endpoint - Đường dẫn API (VD: '/tasks')
 * @param {Object} options  - Tùy chọn: method, token, body, timeoutMs
 * @returns {Object} Dữ liệu JSON từ server
 * @throws {Error} với .status nếu server trả lỗi, hoặc nếu timeout
 */
export async function apiFetch(endpoint, { token, timeoutMs = DEFAULT_TIMEOUT_MS, ...options } = {}) {
  // #29: Timeout qua AbortController
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

  // 401 = phiên đăng nhập hết hạn
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    const err = new Error('Phiên đăng nhập hết hạn')
    err.status = 401
    throw err
  }

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await res.json() : null

  // #28: throw Error (có .stack + .status) thay vì plain object
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  register: (body)  => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login:    (body)  => apiFetch('/auth/login',    { method: 'POST', body: JSON.stringify(body) }),
  me:       (token) => apiFetch('/auth/me', { token }),
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const task = {
  list:   (token)           => apiFetch('/tasks', { token }),
  create: (token, body)     => apiFetch('/tasks', { token, method: 'POST', body: JSON.stringify(body) }),
  update: (token, id, body) => apiFetch(`/tasks/${id}`, { token, method: 'PUT', body: JSON.stringify(body) }),
  delete: (token, id)       => apiFetch(`/tasks/${id}`, { token, method: 'DELETE' }),
}

// ─── Time Entries ─────────────────────────────────────────────────────────────
// Luồng Start/Stop dùng timer.start() / timer.stop().
// timeEntry.create/update chỉ dùng cho manual history edit.

export const timeEntry = {
  list: (token, date) => {
    // URLSearchParams: tránh XSS/encoding bugs khi value có ký tự đặc biệt
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

// ─── Timer ────────────────────────────────────────────────────────────────────

export const timer = {
  start:  (token, body) => apiFetch('/timer/start',  { token, method: 'POST', body: JSON.stringify(body) }),
  active: (token)       => apiFetch('/timer/active', { token }),
  // Stop có timeout riêng ngắn hơn — user cần biết kết quả sớm để quyết định retry
  stop:   (token)       => apiFetch('/timer/stop',   { token, method: 'POST', timeoutMs: 8_000 }),
}

// ─── Scheduled Tasks ─────────────────────────────────────────────────────────

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
