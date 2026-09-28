import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import pool from '../config/db.js'

const router = Router()

router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const { date, from, to } = req.query

    if (from && to) {
      const [rows] = await pool.execute(
        `SELECT te.*, t.title as task_title, t.color as task_color
         FROM time_entries te
         LEFT JOIN tasks t ON te.task_id = t.id
         WHERE te.user_id = ? AND te.date BETWEEN ? AND ?
         ORDER BY te.date, te.start_time`,
        [req.user.id, from, to]
      )
      return res.json(rows)
    }

    const targetDate = date || new Date().toLocaleDateString('sv-SE')
    const [rows] = await pool.execute(
      `SELECT te.*, t.title as task_title, t.color as task_color
       FROM time_entries te
       LEFT JOIN tasks t ON te.task_id = t.id
       WHERE te.user_id = ? AND te.date = ?
       ORDER BY te.start_time`,
      [req.user.id, targetDate]
    )
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/stats', async (req, res) => {
  try {
    const period = req.query.period || 'week'
    const days = period === 'month' ? 30 : 7
    const uid = req.user.id

    const [[{ totalSeconds }]] = await pool.execute(
      `SELECT COALESCE(SUM(duration), 0) AS totalSeconds
       FROM time_entries
       WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`,
      [uid]
    )

    const [byTask] = await pool.execute(
      `SELECT t.id AS taskId, t.title, t.color,
              COALESCE(SUM(te.duration), 0) AS totalSeconds
       FROM tasks t
       LEFT JOIN time_entries te ON te.task_id = t.id
         AND te.user_id = ? AND te.date >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
       WHERE t.user_id = ? AND t.is_active = TRUE
       GROUP BY t.id, t.title, t.color
       ORDER BY totalSeconds DESC`,
      [uid, uid]
    )

    const [byDayRows] = await pool.execute(
      `SELECT date, COALESCE(SUM(duration), 0) AS totalSeconds
       FROM time_entries
       WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
       GROUP BY date
       ORDER BY date`,
      [uid]
    )

    const byDay = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i) 
      const key = d.toLocaleDateString('sv-SE') 
      const found = byDayRows.find((r) => {
        const rd = r.date instanceof Date ? r.date.toLocaleDateString('sv-SE') : String(r.date).slice(0, 10)
        return rd === key
      })

      byDay.push({ date: key, totalSeconds: found ? found.totalSeconds : 0 })
    }

    const [active] = await pool.execute(
      'SELECT id, task_id, start_time, date FROM time_entries WHERE user_id = ? AND end_time IS NULL',
      [uid]
    )

    res.json({ totalSeconds, byTask, byDay, activeEntry: active[0] || null })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { task_id, start_time, date, description } = req.body


    if (!start_time || !date) {
      return res.status(400).json({ error: 'Thiếu start_time hoặc date' })
    }

    const [active] = await pool.execute(
      'SELECT id FROM time_entries WHERE user_id = ? AND end_time IS NULL',
      [req.user.id]
    )
    if (active.length > 0) {
      return res.status(409).json({ error: 'Bạn đã có bản ghi đang chạy' })
    }

    const [result] = await pool.execute(
      'INSERT INTO time_entries (user_id, task_id, start_time, date, description) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, task_id || null, start_time, date, description?.trim() || null]
    )

    const [rows] = await pool.execute('SELECT * FROM time_entries WHERE id = ?', [result.insertId])
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT * FROM time_entries WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi' })
    }

    const { end_time, description } = req.body
    const entry = existing[0]


    let duration = entry.duration
    if (end_time && entry.start_time) {
      duration = Math.floor((new Date(end_time) - new Date(entry.start_time)) / 1000)
    }

    await pool.execute(
      'UPDATE time_entries SET end_time = ?, duration = ?, description = ? WHERE id = ?',
      [end_time || entry.end_time, duration, description ?? entry.description, req.params.id]
    )

    const [rows] = await pool.execute('SELECT * FROM time_entries WHERE id = ?', [req.params.id])
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT * FROM time_entries WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi' })
    }
    await pool.execute('DELETE FROM time_entries WHERE id = ?', [req.params.id])
    res.json({ message: 'Đã xóa bản ghi' })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router
