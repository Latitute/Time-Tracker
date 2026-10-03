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
    // >>> MÃ CẬP NHẬT: Lấy thêm trường progress từ req.body <<<
    const { title, description, category, estimateTime, progress, color } = req.body
    // >>> HẾT MÃ CẬP NHẬT <<<

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Tên công việc không được để trống' })
    }

    // >>> MÃ CẬP NHẬT: Thêm cột progress vào INSERT INTO và mảng tham số [?, ?, ...] <<<
    const [result] = await pool.execute(
      'INSERT INTO tasks (user_id, title, description, category, estimate_time, progress, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        req.user.id, 
        title.trim(), 
        description?.trim() || null, 
        category || 'STUDY', 
        estimateTime || 30, 
        progress || 'TODO', // Mặc định là TODO nếu frontend không truyền lên
        color || '#4361EE'
      ]
    )
    // >>> HẾT MÃ CẬP NHẬT <<<

    const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [result.insertId])
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    // >>> MÃ CẬP NHẬT: Lấy thêm trường progress để xử lý cập nhật <<<
    const { title, description, category, estimateTime, progress, color, is_active } = req.body
    // >>> HẾT MÃ CẬP NHẬT <<<

    const [existing] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' })
    }

    // >>> MÃ CẬP NHẬT: Thêm progress = ? vào UPDATE và đẩy giá trị vào mảng tham số <<<
    await pool.execute(
      'UPDATE tasks SET title = ?, description = ?, category = ?, estimate_time = ?, progress = ?, color = ?, is_active = ? WHERE id = ?',
      [
        title?.trim() || existing[0].title,
        description ?? existing[0].description,
        category || existing[0].category,
        estimateTime !== undefined ? estimateTime : existing[0].estimate_time,
        progress || existing[0].progress, // Giữ nguyên trạng thái cũ nếu không chỉnh sửa
        color || existing[0].color,
        is_active !== undefined ? is_active : existing[0].is_active,
        req.params.id,
      ]
    )
    // >>> HẾT MÃ CẬP NHẬT <<<

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