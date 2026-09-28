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

// Đường dẫn cơ sở của API (tất cả request đều bắt đầu bằng /api)
const BASE = '/api'

/**
 * Tạo header (tiêu đề) cho request.
 * Nếu có token, thêm vào header để server biết ai đang gửi request.
 *
 * "Bearer token": chuẩn bảo mật phổ biến, server dùng token này
 * để xác định bạn là ai (giống như thẻ căn cước).
 *
 * @param {string} token - Token xác thực (lấy từ localStorage)
 * @returns {Object} Các header cho request
 */
function getHeaders(token) {
  const h = { 'Content-Type': 'application/json' }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

/**
 * Hàm chung để gọi API.
 *
 * Cách hoạt động:
 * 1. Gửi request đến server
 * 2. Nếu server trả về 401 (không được phép), xóa token và quay về trang đăng nhập
 * 3. Đọc dữ liệu JSON từ phản hồi
 * 4. Nếu có lỗi, ném ra exception
 *
 * @param {string} endpoint - Đường dẫn API (VD: '/tasks')
 * @param {Object} options - Tùy chọn: method, token, body...
 * @returns {Object} Dữ liệu JSON từ server
 */
export async function apiFetch(endpoint, { token, ...options } = {}) {
  const res = await fetch(`${BASE}${endpoint}`, {
    ...options,
    headers: getHeaders(token)
  })
  // 401 = phiên đăng nhập hết hạn, phải đăng nhập lại
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Phiên đăng nhập hết hạn')
  }
  const data = await res.json()
  // Nếu status không phải 2xx, ném lỗi với thông điệp từ server
  if (!res.ok) throw { message: data.error || 'Request failed', status: res.status }
  return data
}

// ============ CÁC NHÓM HÀM API ============

// Xác thực: đăng ký, đăng nhập, lấy thông tin người dùng
export const auth = {
  // POST /api/auth/register - Đăng ký tài khoản mới
  register: (body) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  // POST /api/auth/login - Đăng nhập
  login: (body) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  // GET /api/auth/me - Lấy thông tin người dùng hiện tại
  me: (token) => apiFetch('/auth/me', { token }),
}

// Công việc: CRUD (Tạo, Đọc, Sửa, Xóa)
export const task = {
  // GET /api/tasks - Lấy danh sách công việc
  list: (token) => apiFetch('/tasks', { token }),
  // POST /api/tasks - Tạo công việc mới
  create: (token, body) => apiFetch('/tasks', { token, method: 'POST', body: JSON.stringify(body) }),
  // PUT /api/tasks/:id - Cập nhật công việc
  update: (token, id, body) => apiFetch(`/tasks/${id}`, { token, method: 'PUT', body: JSON.stringify(body) }),
  // DELETE /api/tasks/:id - Xóa công việc
  delete: (token, id) => apiFetch(`/tasks/${id}`, { token, method: 'DELETE' }),
}

// Bản ghi thời gian (time entries): khi bấm bắt đầu/dừng đồng hồ
export const timeEntry = {
  // GET /api/time-entries?date=YYYY-MM-DD - Lấy bản ghi theo ngày
  list: (token, date) => apiFetch(`/time-entries?date=${date}`, { token }),
  // GET /api/time-entries?from=...&to=... - Lấy bản ghi theo khoảng ngày
  listRange: (token, from, to) => apiFetch(`/time-entries?from=${from}&to=${to}`, { token }),
  // GET /api/time-entries/stats?period=week - Lấy thống kê
  stats: (token, period) => apiFetch(`/time-entries/stats?period=${period}`, { token }),
  // POST /api/time-entries - Tạo bản ghi mới (khi bấm "Bắt đầu")
  create: (token, body) => apiFetch('/time-entries', { token, method: 'POST', body: JSON.stringify(body) }),
  // PUT /api/time-entries/:id - Cập nhật bản ghi (khi bấm "Dừng lại")
  update: (token, id, body) => apiFetch(`/time-entries/${id}`, { token, method: 'PUT', body: JSON.stringify(body) }),
  // DELETE /api/time-entries/:id - Xóa bản ghi
  delete: (token, id) => apiFetch(`/time-entries/${id}`, { token, method: 'DELETE' }),
}

// Lịch hẹn (scheduled tasks): lên kế hoạch trước cho tương lai
export const scheduledTask = {
  // GET /api/scheduled-tasks?date=YYYY-MM-DD - Lấy lịch hẹn theo ngày
  list: (token, date) => apiFetch(`/scheduled-tasks?date=${date}`, { token }),
  // GET /api/scheduled-tasks?from=...&to=... - Lấy lịch hẹn theo khoảng ngày
  listRange: (token, from, to) => apiFetch(`/scheduled-tasks?from=${from}&to=${to}`, { token }),
  // POST /api/scheduled-tasks - Tạo lịch hẹn mới
  create: (token, body) => apiFetch('/scheduled-tasks', { token, method: 'POST', body: JSON.stringify(body) }),
  // PUT /api/scheduled-tasks/:id - Cập nhật lịch hẹn
  update: (token, id, body) => apiFetch(`/scheduled-tasks/${id}`, { token, method: 'PUT', body: JSON.stringify(body) }),
  // DELETE /api/scheduled-tasks/:id - Xóa lịch hẹn
  delete: (token, id) => apiFetch(`/scheduled-tasks/${id}`, { token, method: 'DELETE' }),
}
