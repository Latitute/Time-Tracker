import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import pool from '../config/db.js'

const router = Router()
router.use(authMiddleware)

function isValidDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false
  const [y, m, d] = str.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function isValidTime(str) {
  if (str == null) return true
  const m = typeof str === 'string' && str.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return false
  const h = Number(m[1]), min = Number(m[2]), sec = Number(m[3] ?? 0)
  return h >= 0 && h <= 23 && min >= 0 && min <= 59 && sec >= 0 && sec <= 59
}

function isValidDuration(val) {
  if (val == null) return true
  return Number.isInteger(val) && val > 0
}

router.get('/', async (req, res) => {
  try {
    const { date, from, to } = req.query
    if (from || to) {
      if (!from || !to) {
        return res.status(400).json({ error: 'Cần cả from và to khi dùng range' })
      }
      if (!isValidDate(from) || !isValidDate(to)) {
        return res.status(400).json({ error: 'from/to không hợp lệ (cần YYYY-MM-DD)' })
      }
      if (from > to) {
        return res.status(400).json({ error: 'from phải trước hoặc bằng to' })
      }
      const [rows] = await pool.execute(
        `SELECT st.*, t.title as task_title, t.color as task_color
         FROM scheduled_tasks st
         LEFT JOIN tasks t ON st.task_id = t.id
         WHERE st.user_id = ? AND st.scheduled_date BETWEEN ? AND ?
         ORDER BY st.scheduled_date, st.start_time`,
        [req.user.id, from, to]
      )
      return res.json(rows)
    }

    if (!date) {
      return res.status(400).json({ error: 'Thiếu tham số date' })
    }
    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'date không hợp lệ (cần YYYY-MM-DD)' })
    }

    const [rows] = await pool.execute(
      `SELECT st.*, t.title as task_title, t.color as task_color
       FROM scheduled_tasks st
       LEFT JOIN tasks t ON st.task_id = t.id
       WHERE st.user_id = ? AND st.scheduled_date = ?
       ORDER BY st.start_time`,
      [req.user.id, date]
    )
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { task_id, scheduled_date, start_time, estimated_duration } = req.body
    if (!task_id || !scheduled_date) {
      return res.status(400).json({ error: 'Thiếu task_id hoặc scheduled_date' })
    }
    if (!isValidDate(scheduled_date)) {
      return res.status(400).json({ error: 'scheduled_date không hợp lệ (cần YYYY-MM-DD)' })
    }
    if (!isValidTime(start_time)) {
      return res.status(400).json({ error: 'start_time không hợp lệ (cần HH:mm hoặc HH:mm:ss, VD: 09:30)' })
    }
    if (estimated_duration !== undefined && estimated_duration !== null && !isValidDuration(estimated_duration)) {
      return res.status(400).json({ error: 'estimated_duration phải là số nguyên dương (đơn vị: giây)' })
    }

    const [tasks] = await pool.execute(
      'SELECT id FROM tasks WHERE id = ? AND user_id = ? AND is_active = TRUE',
      [task_id, req.user.id]
    )
    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' })
    }

    const resolvedDuration = estimated_duration ?? 3600

    const [result] = await pool.execute(
      'INSERT INTO scheduled_tasks (user_id, task_id, scheduled_date, start_time, estimated_duration) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, task_id, scheduled_date, start_time || null, resolvedDuration]
    )

    const [rows] = await pool.execute(
      `SELECT st.*, t.title as task_title, t.color as task_color
       FROM scheduled_tasks st
       LEFT JOIN tasks t ON st.task_id = t.id
       WHERE st.id = ?`,
      [result.insertId]
    )
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy lịch hẹn' })
    }

    const { is_completed, start_time, estimated_duration } = req.body

    if (is_completed !== undefined && typeof is_completed !== 'boolean') {
      return res.status(400).json({ error: 'is_completed phải là boolean' })
    }
    if (start_time !== undefined && !isValidTime(start_time)) {
      return res.status(400).json({ error: 'start_time không hợp lệ (cần HH:mm hoặc HH:mm:ss)' })
    }
    if (estimated_duration !== undefined && estimated_duration !== null && !isValidDuration(estimated_duration)) {
      return res.status(400).json({ error: 'estimated_duration phải là số nguyên dương (đơn vị: giây)' })
    }

    await pool.execute(
      'UPDATE scheduled_tasks SET is_completed = ?, start_time = ?, estimated_duration = ? WHERE id = ?',
      [
        is_completed        !== undefined ? is_completed        : existing[0].is_completed,
        start_time          !== undefined ? start_time          : existing[0].start_time,
        estimated_duration  !== undefined ? estimated_duration  : existing[0].estimated_duration,
        req.params.id,
      ]
    )

    const [rows] = await pool.execute(
      `SELECT st.*, t.title as task_title, t.color as task_color
       FROM scheduled_tasks st
       LEFT JOIN tasks t ON st.task_id = t.id
       WHERE st.id = ?`,
      [req.params.id]
    )
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy lịch hẹn' })
    }
    await pool.execute('DELETE FROM scheduled_tasks WHERE id = ?', [req.params.id])
    res.json({ message: 'Đã xóa lịch hẹn' })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router