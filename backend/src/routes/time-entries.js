import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import pool from '../config/db.js'
import { calcOvertime } from '../utils/time-helpers.js'

const router = Router()
router.use(authMiddleware)

// ─── Timezone / datetime contract ─────────────────────────────────────────────
// Tất cả timestamps trong DB là UTC (dùng UTC_TIMESTAMP() ở timer.js).
// "date" nghiệp vụ = ngày local của user (UTC+7), không phải ngày UTC.
// POST manual entry nhận start_time từ client dưới dạng UTC ISO string.
const USER_TZ = '+07:00'

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Kiểm tra ISO datetime hợp lệ. Chấp nhận bất kỳ format nào Date() parse được:
 * "2026-09-30T07:30:00Z", "2026-09-30 07:30:00", "2026-09-30T07:30:00.000Z".
 */
function isValidDatetime(str) {
  if (!str || typeof str !== 'string') return false
  return !Number.isNaN(new Date(str).getTime())
}

// ─── GET /api/time-entries ────────────────────────────────────────────────────

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

    // "Hôm nay" = ngày local user (UTC+7) theo DB
    const [[{ today }]] = await pool.execute(
      `SELECT DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', ?)) AS today`,
      [USER_TZ]
    )
    const targetDate = date || today
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

// ─── GET /api/time-entries/stats ─────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    const period = req.query.period || 'week'
    const days = period === 'month' ? 30 : 7
    // intervalDays = days - 1 → range bao gồm đúng `days` ngày kể cả hôm nay
    const intervalDays = days - 1
    const uid = req.user.id

    // "Hôm nay" local user — cùng nguồn sự thật với mọi query bên dưới
    const [[{ localToday }]] = await pool.execute(
      `SELECT DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', ?)) AS localToday`,
      [USER_TZ]
    )

    const [[{ totalSeconds }]] = await pool.execute(
      `SELECT COALESCE(SUM(duration), 0) AS totalSeconds
       FROM time_entries
       WHERE user_id = ? AND date >= DATE_SUB(?, INTERVAL ${intervalDays} DAY)`,
      [uid, localToday]
    )

    const [byTask] = await pool.execute(
      `SELECT
         COALESCE(t.id, 0)                  AS taskId,
         COALESCE(t.title, 'Không có task') AS title,
         COALESCE(t.color, '#888888')        AS color,
         COALESCE(SUM(te.duration), 0)       AS totalSeconds
       FROM time_entries te
       LEFT JOIN tasks t ON t.id = te.task_id
       WHERE te.user_id = ? AND te.date >= DATE_SUB(?, INTERVAL ${intervalDays} DAY)
       GROUP BY t.id, t.title, t.color
       ORDER BY totalSeconds DESC`,
      [uid, localToday]
    )

    const [byDayRows] = await pool.execute(
      `SELECT date, COALESCE(SUM(duration), 0) AS totalSeconds
       FROM time_entries
       WHERE user_id = ? AND date >= DATE_SUB(?, INTERVAL ${intervalDays} DAY)
       GROUP BY date
       ORDER BY date`,
      [uid, localToday]
    )

    // Dùng Map cho O(1) lookup. Build ngày từ localToday (cùng nguồn với DB query)
    // để tránh mismatch khi Node server chạy UTC nhưng ngày local là UTC+7.
    const dateMap = new Map(
      byDayRows.map(r => [
        r.date instanceof Date
          ? r.date.toISOString().slice(0, 10)
          : String(r.date).slice(0, 10),
        Number(r.totalSeconds)
      ])
    )
    const todayMs = new Date(localToday + 'T00:00:00Z').getTime()
    const byDay = []
    for (let i = days - 1; i >= 0; i--) {
      const key = new Date(todayMs - i * 86400000).toISOString().slice(0, 10)
      byDay.push({ date: key, totalSeconds: dateMap.get(key) ?? 0 })
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

// ─── POST /api/time-entries ───────────────────────────────────────────────────
// Tạo time entry thủ công (lịch sử — KHÔNG dùng khi bấm Start trên timer).
// Invariant "1 active entry / user" được bảo vệ bằng cùng lock users row
// như /timer/start, nên hai endpoint không thể race với nhau.

router.post('/', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const { task_id, start_time, description } = req.body

    // ── Validation ────────────────────────────────────────────────────────────
    if (!start_time) {
      return res.status(400).json({ error: 'Thiếu start_time' })
    }
    if (!isValidDatetime(start_time)) {
      return res.status(400).json({ error: 'start_time không hợp lệ (cần ISO datetime, VD: 2026-09-30T07:30:00Z)' })
    }
    // Business rule: không cho nhập time entry tương lai hơn 1 phút
    // (1 phút grace để tránh false reject do clock skew nhỏ giữa client/server)
    if (new Date(start_time).getTime() > Date.now() + 60_000) {
      return res.status(400).json({ error: 'start_time không được ở tương lai' })
    }

    if (task_id) {
      const [tasks] = await conn.execute(
        'SELECT id FROM tasks WHERE id = ? AND user_id = ? AND is_active = TRUE',
        [task_id, req.user.id]
      )
      if (tasks.length === 0) {
        return res.status(404).json({ error: 'Không tìm thấy công việc' })
      }
    }

    await conn.beginTransaction()

    // ── Lock user row — cùng cơ chế với /timer/start ─────────────────────────
    // Đảm bảo /timer/start và /time-entries POST không race khi tạo active entry.
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

    // date nghiệp vụ = ngày local user, tính từ start_time do client cung cấp.
    // start_time được coi là UTC (theo API contract), convert sang UTC+7 để lấy ngày.
    const [result] = await conn.execute(
      `INSERT INTO time_entries (user_id, task_id, start_time, date, description)
       VALUES (?, ?, ?, DATE(CONVERT_TZ(?, '+00:00', ?)), ?)`,
      [req.user.id, task_id || null, start_time, start_time, USER_TZ, description?.trim() || null]
    )

    await conn.commit()

    const [rows] = await conn.execute('SELECT * FROM time_entries WHERE id = ?', [result.insertId])
    res.status(201).json(rows[0])
  } catch (err) {
    await conn.rollback().catch(() => {})
    console.error('[POST /time-entries]', err)
    res.status(500).json({ error: 'Lỗi server' })
  } finally {
    conn.release()
  }
})

// ─── PUT /api/time-entries/:id ────────────────────────────────────────────────
// Chỉ dùng để sửa metadata / điều chỉnh thời gian của entry ĐÃ hoàn thành.
// Không hỗ trợ "reopen" (set end_time = null) — dùng /timer/start cho luồng đó.
// Khi sửa end_time, tính lại cả duration và overtime_duration nhất quán.

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

    // #6: PUT chỉ dành cho completed entry — không cho edit active entry
    // (Active entry được điều khiển qua /timer/stop)
    if (entry.end_time === null) {
      return res.status(409).json({
        error: 'Không thể sửa bản ghi đang chạy. Dùng /timer/stop để kết thúc trước.',
      })
    }

    // ── Không cho phép reopen ─────────────────────────────────────────────────
    if (end_time === null) {
      return res.status(400).json({
        error: 'Không thể reopen entry đã kết thúc. Dùng /timer/start để tạo timer mới.',
      })
    }

    // #7: Description max length
    if (description !== undefined && description !== null && description.length > 2000) {
      return res.status(400).json({ error: 'Mô tả tối đa 2000 ký tự' })
    }

    // Nếu client không gửi end_time, giữ nguyên giá trị cũ
    const resolvedEndTime = end_time !== undefined ? end_time : entry.end_time

    let duration = entry.duration
    let overtime = entry.overtime_duration ?? 0

    if (resolvedEndTime) {
      // Tính duration trong DB để nhất quán với TIMESTAMPDIFF trong /timer/stop
      const [[{ computed }]] = await pool.execute(
        'SELECT TIMESTAMPDIFF(SECOND, ?, ?) AS computed',
        [entry.start_time, resolvedEndTime]
      )
      if (computed < 0) {
        return res.status(400).json({ error: 'end_time phải sau start_time' })
      }
      // #4: end_time không được ở tương lai (1 phút grace cho clock skew)
      if (new Date(resolvedEndTime).getTime() > Date.now() + 60_000) {
        return res.status(400).json({ error: 'end_time không được ở tương lai' })
      }
      duration = computed
      // Tính lại overtime bằng cùng helper với /timer/stop → nhất quán
      overtime = calcOvertime(duration, entry.target_duration)
    }

    await pool.execute(
      'UPDATE time_entries SET end_time = ?, duration = ?, overtime_duration = ?, description = ? WHERE id = ?',
      [resolvedEndTime, duration, overtime, description ?? entry.description, req.params.id]
    )

    const [rows] = await pool.execute('SELECT * FROM time_entries WHERE id = ?', [req.params.id])
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

// ─── DELETE /api/time-entries/:id ────────────────────────────────────────────
// Single-query atomic: kiểm tra ownership VÀ delete trong cùng một statement.

router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM time_entries WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi' })
    }
    res.json({ message: 'Đã xóa bản ghi' })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router
