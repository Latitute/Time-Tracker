// ─── Timer display ────────────────────────────────────────────────────────────

export function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatDuration(totalSeconds) {
  if (!totalSeconds) return '0m'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ─── Date helpers (local timezone — không dùng toISOString()) ─────────────────

/**
 * Format Date → "YYYY-MM-DD" theo local timezone.
 * KHÔNG dùng toISOString() vì nó chuyển sang UTC trước → sai ngày quanh 00:xx.
 */
export function formatLocalDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Format Date → "HH:MM" theo local timezone.
 * Dùng để hiển thị start_time / end_time thay cho .slice(11, 16).
 */
export function formatLocalTime(d) {
  if (!d) return '—'
  const date = d instanceof Date ? d : parseServerDateTime(d)
  if (!date) return '—'
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Parse chuỗi datetime từ MySQL (dạng "YYYY-MM-DD HH:mm:ss", không có Z).
 * Coi như UTC — nhất quán với cách useTimer.js xử lý start_time.
 * Nếu chuỗi đã có 'Z' hoặc '+' thì parse bình thường.
 */
export function parseServerDateTime(str) {
  if (!str) return null
  if (str instanceof Date) return str
  // Thêm 'Z' nếu chưa có offset để parse như UTC (khớp với MySQL UTC storage)
  const iso = String(str).replace(' ', 'T').replace(/Z?$/, 'Z')
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : new Date(ms)
}

/** Ngày hôm nay dạng "YYYY-MM-DD" (local timezone). */
export function todayDate() {
  return formatLocalDate(new Date())
}

/** Trả về { from, to } cho khoảng N ngày gần nhất (tính cả hôm nay). */
export function localDateRange(days = 30) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  return { from: formatLocalDate(from), to: formatLocalDate(to) }
}

export function nowDateTime() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

