import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import pool from '../config/db.js'
import { calcOvertime } from '../utils/time-helpers.js'

const router = Router()
router.use(authMiddleware)

// ─── Timezone / datetime contract ─────────────────────────────────────────────
// • DB lưu UTC — dùng UTC_TIMESTAMP() thay vì NOW() để không phụ thuộc
//   MySQL session timezone hay OS timezone.
// • "date" nghiệp vụ = ngày local của user (UTC+7), tính từ UTC_TIMESTAMP().
// • Frontend nhận timestamp dạng "YYYY-MM-DD HH:mm:ss" (UTC), parse với
//   parseServerDateTime() rồi convert sang local khi hiển thị.
const USER_TZ = '+07:00'

// ─── Race-condition strategy ───────────────────────────────────────────────────
// Invariant: mỗi user chỉ có tối đa 1 time_entry chưa kết thúc.
//
// Vấn đề với SELECT...FOR UPDATE trên tập rỗng:
//   Request A và B cùng SELECT → đều thấy 0 rows → không có row nào để lock
//   → cả hai đều INSERT thành công → 2 active entries.
//
// Giải pháp: lock một row *luôn tồn tại* của user — users.id.
//   BEGIN
//   SELECT id FROM users WHERE id = ? FOR UPDATE   ← lock user row
//   SELECT active entry                             ← an toàn, không race
//   INSERT nếu chưa có
//   COMMIT
//
// Cả /timer/start và /time-entries POST dùng cùng lock này, nên hai endpoint
// không thể đồng thời tạo active entry cho cùng một user.

// ─── POST /api/timer/start ────────────────────────────────────────────────────
// target_duration = null  → stopwatch (đếm xuôi, không có overtime)
// target_duration = N > 0 → countdown N giây
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
    // Kiểm tra task tồn tại và thuộc user — ngoài transaction (read-only, không ảnh hưởng lock)
    const [tasks] = await conn.execute(
      'SELECT id FROM tasks WHERE id = ? AND user_id = ? AND is_active = TRUE',
      [task_id, req.user.id]
    )
    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' })
    }

    await conn.beginTransaction()

    // ── Bước 1: lock user row (luôn tồn tại) ──────────────────────────────────
    // Điều này serialise mọi /timer/start và /time-entries POST cho cùng user.
    await conn.execute(
      'SELECT id FROM users WHERE id = ? FOR UPDATE',
      [req.user.id]
    )

    // ── Bước 2: kiểm tra active entry sau khi đã lock ─────────────────────────
    const [active] = await conn.execute(
      'SELECT id FROM time_entries WHERE user_id = ? AND end_time IS NULL LIMIT 1',
      [req.user.id]
    )
    if (active.length > 0) {
      await conn.rollback()
      return res.status(409).json({ error: 'Bạn đã có bản ghi đang chạy' })
    }

    // ── Bước 3: insert ─────────────────────────────────────────────────────────
    // UTC_TIMESTAMP() = luôn UTC, bất kể session timezone của MySQL.
    // date nghiệp vụ = ngày local user, convert từ UTC → UTC+7.
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

// ─── GET /api/timer/active ────────────────────────────────────────────────────
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
// Race condition fix: tất cả end_time / duration / overtime_duration được tính
// trong MỘT câu UPDATE duy nhất → ba giá trị cùng một thời điểm, không drift.
//
// Atomic: WHERE id = ? AND user_id = ? AND end_time IS NULL
// → chỉ request đầu tiên thành công (affectedRows=1).
// → request thứ hai gặp affectedRows=0 → 409.
router.post('/stop', async (req, res) => {
  try {
    // Lấy target_duration để tính overtime — không cần lock vì UPDATE phía dưới là atomic
    const [active] = await pool.execute(
      'SELECT id, target_duration FROM time_entries WHERE user_id = ? AND end_time IS NULL LIMIT 1',
      [req.user.id]
    )
    if (active.length === 0) {
      return res.status(404).json({ error: 'Không có bản ghi đang chạy' })
    }

    const entry = active[0]

    // Tính end_time, duration, overtime trong một UPDATE duy nhất:
    // - Không có khoảng lệch T1/T2 (cùng gọi UTC_TIMESTAMP() trong một statement)
    // - WHERE end_time IS NULL đảm bảo chỉ request đầu tiên thành công
    let upd
    if (entry.target_duration != null) {
      // Countdown: overtime = max(0, actual - target)
      ;[upd] = await pool.execute(
        `UPDATE time_entries
         SET end_time          = UTC_TIMESTAMP(),
             duration          = TIMESTAMPDIFF(SECOND, start_time, UTC_TIMESTAMP()),
             overtime_duration = GREATEST(0, TIMESTAMPDIFF(SECOND, start_time, UTC_TIMESTAMP()) - ?)
         WHERE id = ? AND user_id = ? AND end_time IS NULL`,
        [entry.target_duration, entry.id, req.user.id]
      )
    } else {
      // Stopwatch: không có overtime
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
      // Timer đã được stop bởi request khác (auto-stop race, hoặc duplicate click)
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