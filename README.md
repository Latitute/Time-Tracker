# Time Tracker

Web app theo dõi thời gian làm việc với thống kê và gợi ý cải thiện.

## Giới thiệu dự án

Đây là một ứng dụng web giúp người dùng:

- **Ghi nhận thời gian** làm việc theo từng công việc (task)
- **Xem thống kê** qua biểu đồ (cột, tròn) và các chỉ số KPI
- **Lên lịch** trước cho các công việc cần làm

Ứng dụng gồm 2 phần chạy song song:

- **Frontend** (giao diện người dùng) — chạy ở cổng 5173
- **Backend** (server API) — chạy ở cổng 3001

---

## Công nghệ sử dụng (Tech Stack)

Dự án dùng khoảng **15 thư viện** tổng cộng. Dưới đây là giải thích chi tiết từng công nghệ:

### Frontend (Giao diện người dùng)

Frontend là phần người dùng thấy và tương tác trên trình duyệt.

| Công nghệ | Là gì? | Vai trò trong dự án |
|-----------|--------|---------------------|
| **React 19** | Thư viện JavaScript để xây dựng giao diện web. Thay vì viết HTML tĩnh, React cho phép chia giao diện thành các **component** (thành phần) nhỏ, tái sử dụng được. Mỗi trang (Timer, Dashboard, Calendar, Tasks) là một component riêng. | Tạo các trang: đăng nhập, đồng hồ bấm giờ, thống kê, lịch, quản lý công việc |
| **Vite** | Công cụ build (đóng gói) siêu nhanh cho web. Khi chạy `npm run dev`, Vite khởi động server phát triển, tự động tải lại trang khi bạn sửa code (Hot Module Replacement). | Dev server (localhost:5173), build production, proxy API requests |
| **CSS Modules** | Mỗi file `.module.css` chỉ áp dụng cho component tương ứng, tránh xung đột CSS giữa các trang. Ví dụ: `TimerPage.module.css` chỉ ảnh hưởng đến trang Timer. | Định kiểu cho từng trang riêng biệt |
| **Recharts** | Thư viện vẽ biểu đồ dựa trên React. Cung cấp các component như `<BarChart>` (biểu đồ cột), `<PieChart>` (biểu đồ tròn) để hiển thị dữ liệu thống kê. | Biểu đồ cột (giờ theo ngày), biểu đồ tròn (giờ theo công việc) |
| **React Router** | Thư viện điều hướng (routing) cho React. Cho phép tạo nhiều trang mà không cần tải lại trình duyệt. Mỗi URL (`/`, `/dashboard`, `/calendar`) hiển thị trang tương ứng. | Điều hướng giữa các trang: Timer, Dashboard, Calendar, Tasks |
| **date-fns** | Thư viện xử lý ngày tháng nhẹ. Cung cấp các hàm như `format()`, `isToday()` để định dạng và kiểm tra ngày. | Định dạng ngày tháng trên trang Calendar |

### Backend (Server API)

Backend là server nhận request từ frontend, xử lý logic, và tương tác với database.

| Công nghệ | Là gì? | Vai trò trong dự án |
|-----------|--------|---------------------|
| **Express 5** | Framework (khung làm việc) để xây dựng web server bằng Node.js. Giúp tạo các **API endpoint** (URL) dễ dàng. Ví dụ: `app.get('/api/tasks')` tạo URL để lấy danh sách công việc. | Tạo server API với các route: auth, tasks, time-entries, scheduled-tasks |
| **MySQL** | Hệ quản trị cơ sở dữ liệu quan hệ (RDBMS). Dữ liệu được lưu trong các **bảng** (tables) với hàng và cột, giống Excel nhưng mạnh hơn nhiều. | Lưu trữ: người dùng, công việc, bản ghi thời gian, lịch hẹn |
| **mysql2** | Thư viện Node.js kết nối đến MySQL. Sử dụng `pool.execute()` để chạy câu lệnh SQL. `promise` cho phép dùng `async/await` thay vì callback. | Kết nối backend đến MySQL, thực hiện các truy vấn SQL |
| **JWT (jsonwebtoken)** | JSON Web Token — chuẩn bảo mật để xác thực người dùng. Khi đăng nhập, server tạo một **token** (chuỗi mã hóa) gửi cho client. Client gửi token này kèm mỗi request để chứng minh "tôi là ai". | Xác thực người dùng: đăng nhập, bảo vệ các API endpoint |
| **bcryptjs** | Thư viện mã hóa mật khẩu. Khi đăng ký, mật khẩu được **hash** (mã hóa một chiều) trước khi lưu. Khi đăng nhập, so sánh mật khẩu nhập với hash đã lưu. | Mã hóa mật khẩu người dùng trước khi lưu vào database |
| **Helmet** | Middleware bảo mật cho Express. Tự động thêm các HTTP header bảo vệ chống lại các tấn công phổ biến (XSS, clickjacking, v.v.). | Bảo vệ server khỏi các lỗ hổng bảo mật web cơ bản |
| **CORS** | Cross-Origin Resource Sharing — cho phép frontend (chạy ở cổng 5173) gọi API đến backend (chạy ở cổng 3001). Không có CORS, trình duyệt sẽ chặn request vì "khác origin". | Cho phép frontend gọi API backend |
| **dotenv** | Thư viện đọc file `.env` (chứa biến môi trường như mật khẩu database). Giúp giữ thông tin nhạy cảm **khỏi code nguồn** — không commit lên GitHub. | Nạp cấu hình từ file .env (DB_HOST, DB_PASSWORD, JWT_SECRET) |

### Công cụ phát triển

| Công nghệ | Là gì? | Vai trò trong dự án |
|-----------|--------|---------------------|
| **Concurrently** | Chạy nhiều lệnh cùng lúc trong một terminal. Thay vì mở 2 terminal (1 cho frontend, 1 cho backend), chỉ cần `npm run dev` là chạy cả hai. | Chạy frontend + backend song song với 1 lệnh |
| **Nodemon** | Tự động restart server khi file backend thay đổi. Sửa code → lưu → server tự khởi động lại, không cần tắt/bật thủ công. | Auto-reload backend khi sửa code |

---

## Cấu trúc thư mục

```
timetracker/
├── frontend/                # === GIAO DIỆN (React) ===
│   ├── index.html           # Trang HTML gốc (Vite inject JS vào đây)
│   ├── vite.config.js       # Cấu hình Vite: cổng, proxy, host
│   └── src/
│       ├── main.jsx         # Điểm vào — render App vào <div id="root">
│       ├── App.jsx          # Component gốc: routing, layout (sidebar + bottom bar)
│       ├── pages/           # Các trang chính
│       │   ├── LoginPage.jsx        # Đăng nhập
│       │   ├── SignupPage.jsx       # Đăng ký
│       │   ├── TimerPage.jsx        # Đồng hồ bấm giờ (trang chủ)
│       │   ├── DashboardPage.jsx    # Thống kê (biểu đồ)
│       │   ├── CalendarPage.jsx     # Lịch tháng
│       │   └── TasksPage.jsx        # Quản lý công việc (CRUD)
│       ├── context/         # React Context — chia sẻ dữ liệu toàn app
│       │   ├── AuthContext.jsx      # Quản lý đăng nhập (user, token)
│       │   └── ToastContext.jsx     # Hiển thị thông báo (toast)
│       ├── hooks/           # Custom Hooks — logic tái sử dụng
│       │   └── useTimer.js          # Hook đếm thời gian (start/stop/reset)
│       ├── services/        # Giao tiếp với backend
│       │   └── api.js               # Các hàm gọi API (fetch)
│       ├── utils/           # Hàm tiện ích
│       │   ├── format-time.js       # Định dạng thời gian
│       │   └── calendar-utils.js    # Tính ngày cho lịch
│       └── styles/
│           └── global.css          # CSS biến toàn cục (màu, font, spacing)
│
├── backend/                 # === SERVER API (Express) ===
│   ├── package.json         # Cấu hình: dependencies, scripts, ESM
│   └── src/
│       ├── index.js         # Điểm vào — tạo Express app, gắn routes
│       ├── config/
│       │   └── db.js                # Kết nối MySQL (connection pool)
│       ├── middleware/
│       │   └── auth.js              # Xác thực JWT (bảo vệ API)
│       ├── routes/          # Các API endpoint
│       │   ├── auth.js              # POST /login, /register, GET /me
│       │   ├── tasks.js             # CRUD công việc
│       │   ├── time-entries.js      # Bấm giờ, thống kê
│       │   └── scheduled-tasks.js   # Lịch hẹn
│       └── db/              # Database
│           ├── schema.sql           # Tạo bảng (chạy 1 lần)
│           └── seed.sql             # Dữ liệu mẫu (tùy chọn)
│
├── .env                     # Biến môi trường (KHÔNG commit file này!)
├── package.json             # Cấu hình root: concurrently chạy cả 2
└── README.md                # File này
```

---

## Cài đặt và chạy

### Yêu cầu trước

- **Node.js 18+** — tải tại https://nodejs.org (chọn LTS)
- **MySQL 8+** — tải tại https://dev.mysql.com/downloads/ hoặc cài qua Homebrew:

```bash
# macOS (Homebrew)
brew install mysql
brew services start mysql
```

### Các bước cài đặt

```bash
# 1. Cài đặt các thư viện
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# 2. Tạo database
mysql -u root -e "CREATE DATABASE IF NOT EXISTS timetracker"

# 3. Tạo bảng (chạy 1 lần duy nhất)
mysql -u root timetracker < backend/src/db/schema.sql

# 4. (Tùy chọn) Nạp dữ liệu mẫu
mysql -u root timetracker < backend/src/db/seed.sql

# 5. Tạo file .env (xem mẫu ở dưới)
```

### File .env (tạo ở thư mục gốc)

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=timetracker
JWT_SECRET=your-secret-key-here
PORT=3001
```

> **Lưu ý:** Nếu MySQL của bạn có mật khẩu, điền vào `DB_PASSWORD`. `JWT_SECRET` là chuỗi bí mật để mã hóa token — hãy đổi thành chuỗi ngẫu nhiên của bạn.

### Chạy ứng dụng

```bash
# Khởi động cả frontend + backend
npm run dev

# Truy cập:
# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

---

## Các bước phát triển (Step Branches)

Dự án được phát triển theo 6 bước. Mỗi bước có một branch riêng trên GitHub, chỉ chứa code của bước đó + các bước trước (không chứa code từ bước sau).


### Chi tiết từng bước

**Bước 1 — Khởi tạo (`step/1-setup`)**
- Tạo cấu trúc monorepo: `frontend/` + `backend/` + `package.json` root
- Cài đặt Vite + React cho frontend, Express cho backend
- Tạo bảng MySQL trong `schema.sql` (users, tasks, time_entries, scheduled_tasks)
- Thiết kế CSS variables (màu, font, spacing) trong `global.css`

**Bước 2 — Backend API (`step/2-backend-api`)**
- Tạo Express server với Helmet (bảo mật) + CORS
- Viết JWT middleware: kiểm tra token, gắn `req.user`
- Route `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- Mật khẩu được mã hóa bằng bcryptjs trước khi lưu

**Bước 3 — Frontend Auth (`step/3-frontend-auth`)**
- Trang đăng nhập (`LoginPage`) và đăng ký (`SignupPage`)
- `AuthContext`: quản lý trạng thái đăng nhập, tự động kiểm tra token khi mở trang
- `api.js`: hàm gọi API với Bearer token
- `App.jsx`: routing cơ bản, chuyển hướng về `/login` nếu chưa đăng nhập

**Bước 4 — Timer & Tasks (`step/4-timer-tasks`)**
- `TimerPage`: đồng hồ bấm giờ (bắt đầu/dừng), chọn task, xem bản ghi hôm nay
- `TasksPage`: CRUD công việc (tạo, sửa, xóa, đổi màu)
- `useTimer`: custom hook đếm thời gian bằng `setInterval`
- Backend thêm routes: `/api/tasks` (CRUD), `/api/time-entries` (bấm giờ, thống kê)

**Bước 5 — Dashboard (`step/5-dashboard`)**
- `DashboardPage`: hiển thị thống kê tuần với Recharts
- 4 ô KPI: thời gian hôm nay, tuần này, trung bình/ngày, chuỗi ngày
- Biểu đồ cột: số giờ theo từng ngày trong tuần
- Biểu đồ tròn (donut): phân bổ thời gian theo từng công việc
- Thêm `timeEntry.stats()` và `timeEntry.listRange()` vào `api.js`

**Bước 6 — Calendar (`step/6-calendar`)**
- `CalendarPage`: lịch tháng 42 ô (6x7), chuyển tháng trước/sau
- Nhấn vào ngày → xem chi tiết bản ghi + lịch hẹn
- Tạo lịch hẹn mới: chọn task, giờ bắt đầu, thời lượng
- Đánh dấu hoàn thành / xóa lịch hẹn
- Backend thêm route `/api/scheduled-tasks` (CRUD)
- `calendar-utils.js`: hàm tính ngày cho lịch (dùng `date-fns`)

---

## API Endpoints

### Xác thực (không cần token)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | /api/auth/register | Đăng ký tài khoản mới |
| POST | /api/auth/login | Đăng nhập, nhận token |
| GET | /api/auth/me | Lấy thông tin user hiện tại |

### Công việc (cần token)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | /api/tasks | Lấy danh sách công việc |
| POST | /api/tasks | Tạo công việc mới |
| PUT | /api/tasks/:id | Cập nhật công việc |
| DELETE | /api/tasks/:id | Xóa công việc |

### Bản ghi thời gian (cần token)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | /api/time-entries | Lấy bản ghi theo ngày |
| POST | /api/time-entries | Bắt đầu bấm giờ |
| PUT | /api/time-entries/:id | Dừng bấm giờ |
| DELETE | /api/time-entries/:id | Xóa bản ghi |
| GET | /api/time-entries/stats | Lấy thống kê tuần/tháng |

### Lịch hẹn (cần token)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | /api/scheduled-tasks | Lấy lịch hẹn theo ngày |
| POST | /api/scheduled-tasks | Tạo lịch hẹn mới |
| PUT | /api/scheduled-tasks/:id | Cập nhật / đánh dấu hoàn thành |
| DELETE | /api/scheduled-tasks/:id | Xóa lịch hẹn |

---

## Database Schema

Ứng dụng có 4 bảng chính:

### Bảng `users` — Người dùng
| Cột | Kiểu | Mô tả |
|-----|------|--------|
| id | INT | Khóa chính (tự tăng) |
| name | VARCHAR(100) | Tên người dùng |
| email | VARCHAR(255) | Email (duy nhất, dùng để đăng nhập) |
| password_hash | VARCHAR(255) | Mật khẩu đã mã hóa (bcrypt) |

### Bảng `tasks` — Công việc
| Cột | Kiểu | Mô tả |
|-----|------|--------|
| id | INT | Khóa chính |
| user_id | INT | Người dùng sở hữu (khóa ngoại → users) |
| title | VARCHAR(200) | Tên công việc |
| description | TEXT | Mô tả (tùy chọn) |
| color | VARCHAR(7) | Màu hiển thị (VD: #4361EE) |

### Bảng `time_entries` — Bản ghi thời gian
| Cột | Kiểu | Mô tả |
|-----|------|--------|
| id | INT | Khóa chính |
| user_id | INT | Khóa ngoại → users |
| task_id | INT | Khóa ngoại → tasks |
| start_time | DATETIME | Thời gian bắt đầu |
| end_time | DATETIME | Thời gian kết thúc (NULL = đang chạy) |
| duration | INT | Thời lượng (giây) |
| date | DATE | Ngày ghi nhận |

### Bảng `scheduled_tasks` — Lịch hẹn
| Cột | Kiểu | Mô tả |
|-----|------|--------|
| id | INT | Khóa chính |
| user_id | INT | Khóa ngoại → users |
| task_id | INT | Khóa ngoại → tasks |
| scheduled_date | DATE | Ngày hẹn |
| start_time | DATETIME | Giờ bắt đầu dự kiến |
| estimated_duration | INT | Thời lượng dự kiến (giây) |
| completed | BOOLEAN | Đã hoàn thành chưa |
