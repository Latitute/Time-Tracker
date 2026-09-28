import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import pool from '../config/db.js'

const router = Router()

router.use(authMiddleware)

router.post('/start', async (req, res) => {
  const { task_id } = req.body

  if (!task_id) {
    return res.status(400).json({ error: 'task_id là bắt buộc' })
  }

  try {
    const [tasks] = await pool.execute(
      'SELECT id FROM tasks WHERE id = ? AND user_id = ? AND is_active = TRUE',
      [task_id, req.user.id]
    )
    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' })
    }
    const [active] = await pool.execute(
      'SELECT id FROM time_entries WHERE user_id = ? AND end_time IS NULL',
      [req.user.id]
    )
    if (active.length > 0) {
      return res.status(409).json({ error: 'Bạn đã có bản ghi đang chạy' })
    }

    const date = new Date().toLocaleDateString('sv-SE')
    const [result] = await pool.execute(
      'INSERT INTO time_entries (user_id, task_id, start_time, date) VALUES (?, ?, NOW(), ?)',
      [req.user.id, task_id, date]
    )

    const [rows] = await pool.execute(
      `SELECT te.*, t.title AS task_title, t.color AS task_color
       FROM time_entries te
       LEFT JOIN tasks t ON t.id = te.task_id
       WHERE te.id = ?`,
      [result.insertId]
    )
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/active', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT te.*, t.title AS task_title, t.color AS task_color
       FROM time_entries te
       LEFT JOIN tasks t ON t.id = te.task_id
       WHERE te.user_id = ? AND te.end_time IS NULL
       LIMIT 1`,
      [req.user.id]
    )
    res.json(rows[0] || null)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/stop', async (req, res) => {
  try {
    const [active] = await pool.execute(
      'SELECT id, start_time FROM time_entries WHERE user_id = ? AND end_time IS NULL LIMIT 1',
      [req.user.id]
    )
    if (active.length === 0) {
      return res.status(404).json({ error: 'Không có bản ghi đang chạy' })
    }

    const entry = active[0]

    const [[{ duration }]] = await pool.execute(
      'SELECT TIMESTAMPDIFF(SECOND, ?, NOW()) AS duration',
      [entry.start_time]
    )

    await pool.execute(
      'UPDATE time_entries SET end_time = NOW(), duration = ? WHERE id = ?',
      [duration, entry.id]
    )

    const [rows] = await pool.execute(
      `SELECT te.*, t.title AS task_title, t.color AS task_color
       FROM time_entries te
       LEFT JOIN tasks t ON t.id = te.task_id
       WHERE te.id = ?`,
      [entry.id]
    )
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router