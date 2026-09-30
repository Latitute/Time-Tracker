import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import pool from '../config/db.js'

const router = Router()
router.use(authMiddleware)

const VALID_CATEGORIES = ['STUDY', 'WORK', 'READING', 'SOCIAL', 'ENTERTAINMENT', 'EXERCISE', 'REST', 'OTHERS']

function isValidHexColor(val) {
  if (val == null) return true
  return typeof val === 'string' && /^#[0-9A-Fa-f]{6}$/.test(val)
}

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
    const { title, description, color, category } = req.body
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Tên công việc không được để trống' })
    }
    if (title.trim().length > 200) {
      return res.status(400).json({ error: 'Tên công việc tối đa 200 ký tự' })
    }
    if (description && description.length > 2000) {
      return res.status(400).json({ error: 'Mô tả tối đa 2000 ký tự' })
    }
    if (color !== undefined && !isValidHexColor(color)) {
      return res.status(400).json({ error: 'color không hợp lệ (cần #RRGGBB, VD: #4361EE)' })
    }
    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `category không hợp lệ. Chọn một trong: ${VALID_CATEGORIES.join(', ')}`,
      })
    }

    const [result] = await pool.execute(
      'INSERT INTO tasks (user_id, title, description, color, category) VALUES (?, ?, ?, ?, ?)',
      [
        req.user.id,
        title.trim(),
        description?.trim() || null,
        color || '#4361EE',
        category || 'STUDY',
      ]
    )

    const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [result.insertId])
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' })
    }

    const { title, description, color, category, is_active } = req.body

    if (title !== undefined && !title?.trim()) {
      return res.status(400).json({ error: 'Tên công việc không được để trống' })
    }
    if (title !== undefined && title.trim().length > 200) {
      return res.status(400).json({ error: 'Tên công việc tối đa 200 ký tự' })
    }
    if (description !== undefined && description && description.length > 2000) {
      return res.status(400).json({ error: 'Mô tả tối đa 2000 ký tự' })
    }
    if (color !== undefined && !isValidHexColor(color)) {
      return res.status(400).json({ error: 'color không hợp lệ (cần #RRGGBB)' })
    }
    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `category không hợp lệ. Chọn một trong: ${VALID_CATEGORIES.join(', ')}`,
      })
    }
    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active phải là boolean' })
    }
    if (is_active === false && existing[0].is_active) {
      const [activeEntry] = await pool.execute(
        'SELECT id FROM time_entries WHERE task_id = ? AND end_time IS NULL LIMIT 1',
        [req.params.id]
      )
      if (activeEntry.length > 0) {
        return res.status(409).json({
          error: 'Không thể lưu trữ công việc đang có timer chạy. Vui lòng dừng timer trước.',
        })
      }
    }

    await pool.execute(
      'UPDATE tasks SET title = ?, description = ?, color = ?, category = ?, is_active = ? WHERE id = ?',
      [
        title?.trim()   ?? existing[0].title,
        description     ?? existing[0].description,
        color           ?? existing[0].color,
        category        ?? existing[0].category,
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
    const [activeEntry] = await pool.execute(
      'SELECT id FROM time_entries WHERE task_id = ? AND end_time IS NULL LIMIT 1',
      [req.params.id]
    )
    if (activeEntry.length > 0) {
      return res.status(409).json({
        error: 'Không thể lưu trữ công việc đang có timer chạy. Vui lòng dừng timer trước.',
      })
    }

    const [result] = await pool.execute(
      'UPDATE tasks SET is_active = FALSE WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' })
    }
    res.json({ message: 'Đã lưu trữ công việc' })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router