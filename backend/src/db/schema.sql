-- ============================================================
-- SCHEMA.SQL - Cấu trúc cơ sở dữ liệu (Database Schema)
-- ============================================================
-- File này định nghĩa các bảng (tables) trong cơ sở dữ liệu.
-- Khi chạy file này, MySQL sẽ tạo ra 4 bảng:
--   1. users          - Bảng người dùng (tài khoản)
--   2. tasks          - Bảng công việc
--   3. time_entries   - Bảng ghi nhận thời gian làm việc
--   4. scheduled_tasks - Bảng lịch trình công việc
--
-- Cách chạy: mysql -u root timetracker < backend/src/db/schema.sql
-- ============================================================

-- -----------------------------------------------------------
-- BẢNG USERS (Người dùng)
-- -----------------------------------------------------------
-- Lưu thông tin tài khoản của người dùng ứng dụng.
-- Mỗi người dùng có email duy nhất (UNIQUE).
-- Mật khẩu được mã hóa (hash) trước khi lưu, KHÔNG lưu plaintext.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,        -- ID tự tăng, khóa chính
  name VARCHAR(100) NOT NULL,               -- Tên người dùng (bắt buộc)
  email VARCHAR(255) NOT NULL UNIQUE,       -- Email (bắt buộc, không trùng)
  password_hash VARCHAR(255) NOT NULL,      -- Mật khẩu đã mã hóa bằng bcrypt
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- Thời gian tạo tài khoản
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP  -- Tự cập nhật khi sửa
);

-- -----------------------------------------------------------
-- BẢNG TASKS (Công việc)
-- -----------------------------------------------------------
-- Mỗi công việc thuộc về 1 người dùng (qua user_id).
-- Khi xóa người dùng, tất cả công việc của họ cũng bị xóa (ON DELETE CASCADE).
-- is_active = TRUE nghĩa là công việc còn hoạt động.
-- is_active = FALSE nghĩa là đã "xóa mềm" (soft delete - ẩn đi nhưng vẫn còn trong DB).
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,        -- ID tự tăng, khóa chính
  user_id INT NOT NULL,                     -- ID của người sở hữu công việc
  title VARCHAR(255) NOT NULL,              -- Tiêu đề công việc (bắt buộc)
  description TEXT,                         -- Mô tả chi tiết (tùy chọn)
  color VARCHAR(7) DEFAULT '#4361EE',       -- Màu hiển thị (mã hex, vd: #4361EE = màu xanh)
  is_active BOOLEAN DEFAULT TRUE,           -- Trạng thái hoạt động (TRUE = còn, FALSE = đã xóa mềm)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- Thời gian tạo
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE  -- Khóa ngoại liên kết với bảng users
);

-- -----------------------------------------------------------
-- BẢNG TIME_ENTRIES (Ghi nhận thời gian)
-- -----------------------------------------------------------
-- Đây là bảng chính để theo dõi thời gian làm việc.
-- Mỗi bản ghi (entry) ghi nhận: ai làm, việc gì, từ mấy giờ đến mấy giờ.
-- - start_time: Thời gian bắt đầu bấm giờ
-- - end_time: Thời gian dừng (NULL nếu đang chạy)
-- - duration: Tổng số giây làm được (tự tính từ start_time và end_time)
-- - date: Ngày làm việc
-- Khi xóa công việc (task), task_id sẽ thành NULL nhưng bản ghi thời gian vẫn giữ lại.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS time_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,        -- ID tự tăng, khóa chính
  user_id INT NOT NULL,                     -- ID người dùng
  task_id INT,                              -- ID công việc (có thể NULL nếu task bị xóa)
  start_time DATETIME NOT NULL,             -- Thời gian bắt đầu (vd: '2026-05-04 08:00:00')
  end_time DATETIME NULL,                   -- Thời gian kết thúc (NULL = đang chạy)
  duration INT DEFAULT 0,                   -- Số giây làm được (tự tính toán)
  description TEXT,                         -- Ghi chú cho bản ghi này
  date DATE NOT NULL,                       -- Ngày làm việc (vd: '2026-05-04')
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- Thời gian tạo bản ghi
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,       -- Xóa user => xóa tất cả entries
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL       -- Xóa task => task_id thành NULL
);

-- -----------------------------------------------------------
-- BẢNG SCHEDULED_TASKS (Lịch trình công việc)
-- -----------------------------------------------------------
-- Bảng này dùng để lên lịch trước cho các công việc.
-- Vd: "Ngày mai 9h sáng sẽ làm Học React, dự kiến 2 tiếng".
-- estimated_duration: Thời gian dự kiến làm (mặc định 3600 giây = 1 tiếng).
-- is_completed: Đã hoàn thành chưa.
-- Khi xóa user hoặc task, lịch trình cũng bị xóa theo (CASCADE).
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,        -- ID tự tăng, khóa chính
  user_id INT NOT NULL,                     -- ID người dùng
  task_id INT NOT NULL,                     -- ID công việc (bắt buộc phải có)
  scheduled_date DATE NOT NULL,             -- Ngày dự định làm việc
  start_time TIME,                          -- Giờ bắt đầu dự kiến (vd: '09:00:00')
  estimated_duration INT DEFAULT 3600,      -- Thời gian dự kiến (giây), mặc định = 1 tiếng
  is_completed BOOLEAN DEFAULT FALSE,       -- Đã hoàn thành chưa
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- Thời gian tạo lịch
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,     -- Xóa user => xóa lịch
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE      -- Xóa task => xóa lịch
);

-- -----------------------------------------------------------
-- INDEX (Chỉ mục) - Giúp truy vấn nhanh hơn
-- -----------------------------------------------------------
-- Index giống như "mục lục" của sách, giúp MySQL tìm dữ liệu nhanh hơn.
-- Ví dụ: Khi tìm tất cả time_entries của user X trong ngày Y,
-- MySQL sẽ dùng index này thay vì phải duyệt qua toàn bộ bảng.
-- -----------------------------------------------------------
CREATE INDEX idx_time_entries_user_date ON time_entries(user_id, date);
CREATE INDEX idx_scheduled_user_date ON scheduled_tasks(user_id, scheduled_date);
