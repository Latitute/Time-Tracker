import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import pool from '../config/db.js'

const router = Router()
router.use(authMiddleware)

// GET: Lấy lịch trình với chuẩn hóa ngày tháng
router.get('/', async (req, res) => {
  try {
    const { date, from, to } = req.query
    
    // Câu lệnh SQL chuẩn hóa cột scheduled_date về dạng DATE
    let sql = `
      SELECT st.*, t.title as task_title, t.color as task_color 
      FROM scheduled_tasks st
      INNER JOIN tasks t ON st.task_id = t.id
      WHERE st.user_id = ?
    `
    let params = [req.user.id]

    if (from && to) {
      // Ép kiểu DATE() để so sánh đúng định dạng YYYY-MM-DD
      sql += ` AND DATE(st.scheduled_date) BETWEEN DATE(?) AND DATE(?)`
      params.push(from, to)
    } else if (date) {
      sql += ` AND DATE(st.scheduled_date) = DATE(?)`
      params.push(date)
    }

    const [rows] = await pool.execute(sql + " ORDER BY st.scheduled_date, st.start_time", params)
    res.json(rows)
  } catch (error) {
    console.error('Fetch schedule error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST: Thêm lịch trình mới (Đã cập nhật để nhận Deadline)
router.post('/', async (req, res) => {
  try {
    const { 
      task_id, 
      new_task_title, 
      category, 
      color, 
      scheduled_date, 
      start_time,
      deadline_date, // <-- Hứng thêm deadline_date từ frontend
      deadline_time  // <-- Hứng thêm deadline_time từ frontend
    } = req.body

    if (!scheduled_date) {
      return res.status(400).json({ error: 'Missing scheduled_date' })
    }

    let finalTaskId = task_id

    // Tự động tạo Task mẫu nếu là việc mới
    if ((!finalTaskId || finalTaskId === 'new') && new_task_title) {
      const [taskResult] = await pool.execute(
        'INSERT INTO tasks (user_id, title, category, color) VALUES (?, ?, ?, ?)',
        [req.user.id, new_task_title.trim(), category || 'STUDY', color || '#4C6EF5']
      )
      finalTaskId = taskResult.insertId
    }

    if (!finalTaskId || finalTaskId === 'new') {
      return res.status(400).json({ error: 'Missing valid task_id' })
    }

    // === CẬP NHẬT: Thêm 2 cột deadline vào câu lệnh INSERT ===
    const [result] = await pool.execute(
      `INSERT INTO scheduled_tasks (user_id, task_id, scheduled_date, start_time, deadline_date, deadline_time) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, 
        finalTaskId, 
        scheduled_date, 
        start_time || null,
        deadline_date || null, // Nếu không nhập sẽ lưu NULL
        deadline_time || null  // Nếu không nhập sẽ lưu NULL
      ]
    )

    const [rows] = await pool.execute(
      `SELECT st.*, t.title as task_title, t.color as task_color
       FROM scheduled_tasks st
       INNER JOIN tasks t ON st.task_id = t.id
       WHERE st.id = ?`,
      [result.insertId]
    )
    
    res.status(201).json(rows[0])
  } catch (error) {
    console.error('Create schedule error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router