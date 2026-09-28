import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import pool from '../config/db.js'

const router = Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM tasks WHERE user_id = ? AND is_active = TRUE ORDER BY created_at DESC',
      [req.user.id]
    )
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { title, description, color } = req.body

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Tên công việc không được để trống' })
    }

    const [result] = await pool.execute(
      'INSERT INTO tasks (user_id, title, description, color) VALUES (?, ?, ?, ?)',
      [req.user.id, title.trim(), description?.trim() || null, color || '#4361EE']
    )

    const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [result.insertId])
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { title, description, color, is_active } = req.body

    const [existing] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' })
    }

    await pool.execute(
      'UPDATE tasks SET title = ?, description = ?, color = ?, is_active = ? WHERE id = ?',
      [
        title?.trim() || existing[0].title,
        description ?? existing[0].description,
        color || existing[0].color,
        is_active !== undefined ? is_active : existing[0].is_active,
        req.params.id,
      ]
    )

    const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [req.params.id])
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' })
    }
    await pool.execute('UPDATE tasks SET is_active = FALSE WHERE id = ?', [req.params.id])
    res.json({ message: 'Đã xóa công việc' })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router
