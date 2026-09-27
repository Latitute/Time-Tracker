import express from 'express';
import mysql from 'mysql2/promise';

const router = express.Router();

// Kết nối CSDL — tạm dùng, sau Người 1 xong sẽ đổi sang dùng chung
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'timetracker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ✅ Bypass Auth — TẠM THỜI gán user cố định, không cần đăng nhập
const bypassAuth = (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
};

// Lấy danh sách lịch hẹn theo ngày/tháng
router.get('/', bypassAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, year, date } = req.query;

    let query = `
      SELECT st.*, t.title as task_title, t.color as task_color
      FROM scheduled_tasks st
      LEFT JOIN tasks t ON st.task_id = t.id
      WHERE st.user_id = ?
    `;
    const params = [userId];

    if (date) {
      query += ' AND st.scheduled_date = ?';
      params.push(date);
    } else if (month && year) {
      query += ' AND MONTH(st.scheduled_date) = ? AND YEAR(st.scheduled_date) = ?';
      params.push(month, year);
    }

    query += ' ORDER BY st.scheduled_date ASC, st.start_time ASC';

    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Lỗi lấy lịch hẹn:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Tạo lịch hẹn mới
router.post('/', bypassAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { task_id, scheduled_date, start_time, estimated_duration } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO scheduled_tasks 
       (user_id, task_id, scheduled_date, start_time, estimated_duration, completed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, task_id, scheduled_date, start_time, estimated_duration, false]
    );

    const [newTask] = await pool.execute(
      `SELECT st.*, t.title as task_title, t.color as task_color
       FROM scheduled_tasks st
       LEFT JOIN tasks t ON st.task_id = t.id
       WHERE st.id = ?`,
      [result.insertId]
    );

    res.status(201).json(newTask[0]);
  } catch (err) {
    console.error('Lỗi tạo lịch hẹn:', err);
    res.status(500).json({ error: 'Tạo lịch hẹn thất bại' });
  }
});

// Cập nhật / Đánh dấu hoàn thành
router.put('/:id', bypassAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { completed, ...data } = req.body;

    const setParts = [];
    const params = [];

    if (completed !== undefined) {
      setParts.push('completed = ?');
      params.push(completed);
    }
    Object.entries(data).forEach(([key, value]) => {
      setParts.push(`?? = ?`);
      params.push(key, value);
    });
    params.push(req.params.id, userId);

    await pool.execute(
      `UPDATE scheduled_tasks SET ${setParts.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    const [updated] = await pool.execute(
      `SELECT st.*, t.title as task_title, t.color as task_color
       FROM scheduled_tasks st
       LEFT JOIN tasks t ON st.task_id = t.id
       WHERE st.id = ?`,
      [req.params.id]
    );

    res.json(updated[0]);
  } catch (err) {
    console.error('Lỗi cập nhật:', err);
    res.status(500).json({ error: 'Cập nhật thất bại' });
  }
});

// Xóa lịch hẹn
router.delete('/:id', bypassAuth, async (req, res) => {
  try {
    await pool.execute(
      'DELETE FROM scheduled_tasks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Xóa thất bại' });
  }
});

// Lấy danh sách Task (dùng cho dropdown chọn công việc)
router.get('/tasks', bypassAuth, async (req, res) => {
  try {
    const [tasks] = await pool.execute(
      'SELECT * FROM tasks WHERE user_id = ? ORDER BY title',
      [req.user.id]
    );
    res.json(tasks);
  } catch (err) {
    res.json([]); // Trả mảng rỗng nếu chưa có bảng tasks
  }
});

export default router;