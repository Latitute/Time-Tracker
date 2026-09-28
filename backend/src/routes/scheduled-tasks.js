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
        `SELECT st.*, t.title as task_title, t.color as task_color
         FROM scheduled_tasks st
         INNER JOIN tasks t ON st.task_id = t.id
         WHERE st.user_id = ? AND st.scheduled_date BETWEEN ? AND ?
         ORDER BY st.scheduled_date, st.start_time`,
        [req.user.id, from, to]
      )
      return res.json(rows)
    }

    if (!date) {
      return res.status(400).json({ error: 'Thiếu tham số date' })
    }

    const [rows] = await pool.execute(
      `SELECT st.*, t.title as task_title, t.color as task_color
       FROM scheduled_tasks st
       INNER JOIN tasks t ON st.task_id = t.id
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

     const [result] = await pool.execute(
      'INSERT INTO scheduled_tasks (user_id, task_id, scheduled_date, start_time, estimated_duration) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, task_id, scheduled_date, start_time || null, estimated_duration || 3600]
    )

const [rows] = await pool.execute(
      `SELECT st.*, t.title as task_title, t.color as task_color
       FROM scheduled_tasks st
       INNER JOIN tasks t ON st.task_id = t.id
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

    await pool.execute(
      'UPDATE scheduled_tasks SET is_completed = ?, start_time = ?, estimated_duration = ? WHERE id = ?',
      [
        is_completed !== undefined ? is_completed : existing[0].is_completed,
        start_time ?? existing[0].start_time,
        estimated_duration ?? existing[0].estimated_duration,
        req.params.id,
      ]
    )

    const [rows] = await pool.execute(
      `SELECT st.*, t.title as task_title, t.color as task_color
       FROM scheduled_tasks st
       INNER JOIN tasks t ON st.task_id = t.id
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