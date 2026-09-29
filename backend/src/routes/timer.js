import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import pool from '../config/db.js'

const router = Router()

router.use(authMiddleware)

// ─── POST /api/timer/start ────────────────────────────────────────────────────
// Nhận task_id và target_duration (giây, tuỳ chọn).
// target_duration = null  → stopwatch (đếm xuôi, không countdown)
// target_duration = N > 0 → countdown N giây
router.post('/start', async (req, res) => {
  const { task_id, target_duration = null } = req.body

  if (!task_id) {
    return res.status(400).json({ error: 'task_id là bắt buộc' })
  }

  // Nếu có target_duration thì phải là số nguyên dương
  if (target_duration !== null && (!Number.isInteger(target_duration) || target_duration <= 0)) {
    return res.status(400).json({ error: 'target_duration không hợp lệ (phải là số nguyên dương, đơn vị: giây)' })
  }

  try {
    // Kiểm tra task tồn tại, thuộc user và còn active
    const [tasks] = await pool.execute(
      'SELECT id FROM tasks WHERE id = ? AND user_id = ? AND is_active = TRUE',
      [task_id, req.user.id]
    )
    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' })
    }

    // Kiểm tra user đã có timer khác đang chạy chưa
    const [active] = await pool.execute(
      'SELECT id FROM time_entries WHERE user_id = ? AND end_time IS NULL',
      [req.user.id]
    )
    if (active.length > 0) {
      return res.status(409).json({ error: 'Bạn đã có bản ghi đang chạy' })
    }

    // INSERT có target_duration — tận dụng field sẵn có trong schema
    // Dùng CURDATE() thay vì Node date để tránh lệch timezone khi gần 00:00
    const [result] = await pool.execute(
      'INSERT INTO time_entries (user_id, task_id, start_time, target_duration, date) VALUES (?, ?, NOW(), ?, CURDATE())',
      [req.user.id, task_id, target_duration]
    )

    const [rows] = await pool.execute(
      `SELECT te.*, t.title AS task_title, t.color AS task_color
       FROM time_entries te
       LEFT JOIN tasks t ON t.id = te.task_id
       WHERE te.id = ?`,
      [result.insertId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('[timer/start]', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

// ─── GET /api/timer/active ────────────────────────────────────────────────────
// Trả về timer đang chạy (nếu có) kèm start_time và target_duration
// Frontend tự tính: remaining = target_duration - (now - start_time)
router.get('/active', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT te.id, te.task_id, te.start_time, te.target_duration, te.end_time,
              t.title AS task_title, t.color AS task_color
       FROM time_entries te
       LEFT JOIN tasks t ON t.id = te.task_id
       WHERE te.user_id = ? AND te.end_time IS NULL
       LIMIT 1`,
      [req.user.id]
    )
    res.json(rows[0] || null)
  } catch (err) {
    console.error('[timer/active]', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

// ─── POST /api/timer/stop ─────────────────────────────────────────────────────
// Dừng timer: tính actual duration bằng TIMESTAMPDIFF, lưu overtime nếu có
router.post('/stop', async (req, res) => {
  try {
    const [active] = await pool.execute(
      'SELECT id, start_time, target_duration FROM time_entries WHERE user_id = ? AND end_time IS NULL LIMIT 1',
      [req.user.id]
    )
    if (active.length === 0) {
      return res.status(404).json({ error: 'Không có bản ghi đang chạy' })
    }

    const entry = active[0]

    // Tính actual duration từ DB (tránh sai lệch clock client)
    const [[{ actual_duration }]] = await pool.execute(
      'SELECT TIMESTAMPDIFF(SECOND, ?, NOW()) AS actual_duration',
      [entry.start_time]
    )

    // overtime = thời gian thực - thời gian dự kiến (có thể âm nếu dừng sớm)
    const overtime = Math.max(0, actual_duration - (entry.target_duration || 0))

    await pool.execute(
      `UPDATE time_entries
       SET end_time = NOW(),
           duration = ?,
           overtime_duration = ?
       WHERE id = ?`,
      [actual_duration, overtime, entry.id]
    )

    const [rows] = await pool.execute(
      `SELECT te.*, t.title AS task_title, t.color AS task_color
       FROM time_entries te
       LEFT JOIN tasks t ON t.id = te.task_id
       WHERE te.id = ?`,
      [entry.id]
    )
    res.json(rows[0])
  } catch (err) {
    console.error('[timer/stop]', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router