import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import pool from '../config/db.js'
import { calcOvertime } from '../utils/time-helpers.js'

const router = Router()
router.use(authMiddleware)

const USER_TZ = '+07:00'

router.post('/start', async (req, res) => {
  const { task_id, target_duration = null } = req.body

  if (!task_id) {
    return res.status(400).json({ error: 'task_id là bắt buộc' })
  }
  if (target_duration !== null && (!Number.isInteger(target_duration) || target_duration <= 0)) {
    return res.status(400).json({ error: 'target_duration không hợp lệ (phải là số nguyên dương, đơn vị: giây)' })
  }

  const conn = await pool.getConnection()
  try {
    const [tasks] = await conn.execute(
      'SELECT id FROM tasks WHERE id = ? AND user_id = ? AND is_active = TRUE',
      [task_id, req.user.id]
    )
    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' })
    }

    await conn.beginTransaction()

    await conn.execute(
      'SELECT id FROM users WHERE id = ? FOR UPDATE',
      [req.user.id]
    )

    const [active] = await conn.execute(
      'SELECT id FROM time_entries WHERE user_id = ? AND end_time IS NULL LIMIT 1',
      [req.user.id]
    )
    if (active.length > 0) {
      await conn.rollback()
      return res.status(409).json({ error: 'Bạn đã có bản ghi đang chạy' })
    }

    const [result] = await conn.execute(
      `INSERT INTO time_entries (user_id, task_id, start_time, target_duration, date)
       VALUES (?, ?, UTC_TIMESTAMP(), ?, DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', ?)))`,
      [req.user.id, task_id, target_duration, USER_TZ]
    )

    await conn.commit()

    const [rows] = await conn.execute(
      `SELECT te.*, t.title AS task_title, t.color AS task_color
       FROM time_entries te
       LEFT JOIN tasks t ON t.id = te.task_id
       WHERE te.id = ?`,
      [result.insertId]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    await conn.rollback().catch(() => {})
    console.error('[timer/start]', err)
    res.status(500).json({ error: 'Lỗi server' })
  } finally {
    conn.release()
  }
})

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

router.post('/stop', async (req, res) => {
  try {
    const [active] = await pool.execute(
      'SELECT id, target_duration FROM time_entries WHERE user_id = ? AND end_time IS NULL LIMIT 1',
      [req.user.id]
    )
    if (active.length === 0) {
      return res.status(404).json({ error: 'Không có bản ghi đang chạy' })
    }

    const entry = active[0]

    let upd
    if (entry.target_duration != null) {
      ;[upd] = await pool.execute(
        `UPDATE time_entries
         SET end_time          = UTC_TIMESTAMP(),
             duration          = TIMESTAMPDIFF(SECOND, start_time, UTC_TIMESTAMP()),
             overtime_duration = GREATEST(0, TIMESTAMPDIFF(SECOND, start_time, UTC_TIMESTAMP()) - ?)
         WHERE id = ? AND user_id = ? AND end_time IS NULL`,
        [entry.target_duration, entry.id, req.user.id]
      )
    } else {
      ;[upd] = await pool.execute(
        `UPDATE time_entries
         SET end_time          = UTC_TIMESTAMP(),
             duration          = TIMESTAMPDIFF(SECOND, start_time, UTC_TIMESTAMP()),
             overtime_duration = 0
         WHERE id = ? AND user_id = ? AND end_time IS NULL`,
        [entry.id, req.user.id]
      )
    }

    if (upd.affectedRows === 0) {
      return res.status(409).json({ error: 'Timer đã được dừng bởi request khác' })
    }

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