import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import pool from '../config/db.js'

const router = Router()

router.use(rateLimit({ windowMs: 60000, max: 10 }))

const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' })

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' })
    }
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Email không hợp lệ' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), passwordHash]
    )

    const user = { id: result.insertId, name: name.trim(), email: email.trim().toLowerCase() }

    res.status(201).json({ user, token: signToken(user) })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email đã được sử dụng' })
    }
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' })
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()])

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu sai' })
    }

    const user = rows[0]

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu sai' })
    }

    const token = signToken(user)
    res.json({ user: { id: user.id, name: user.name, email: user.email }, token })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/me', async (req, res) => {
  const auth = req.headers.authorization

  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập' })
  }

  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET)

    const [rows] = await pool.execute('SELECT id, name, email FROM users WHERE id = ?', [decoded.id])

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy user' })
    }

    res.json({ user: rows[0] })
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ' })
  }
})

export default router
