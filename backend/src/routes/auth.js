import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import pool from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(rateLimit({ windowMs: 60000, max: 10 }))

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }

  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

router.post('/register', async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = typeof req.body.password === 'string' ? req.body.password : ''

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please fill in all the information.' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'The password must have at least 6 characters.' })
    }
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' })
    }

    const [existingUsers] = await pool.execute('SELECT id FROM users WHERE email = ?', [email])
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Email is already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash],
    )
    const user = { id: result.insertId, name, email }

    return res.status(201).json({ user, token: signToken(user) })
  } catch (error) {
    return res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({
      error: error.code === 'ER_DUP_ENTRY' ? 'Email is already registered' : 'Server error',
    })
  }
})

router.post('/login', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = typeof req.body.password === 'string' ? req.body.password : ''

    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter your email and password' })
    }

    const [users] = await pool.execute(
      'SELECT id, name, email, password_hash FROM users WHERE email = ?',
      [email],
    )
    const user = users[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password' })
    }

    const safeUser = { id: user.id, name: user.name, email: user.email }
    return res.json({ user: safeUser, token: signToken(safeUser) })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, name, email FROM users WHERE id = ?',
      [req.user.id],
    )
    if (!users[0]) {
      return res.status(404).json({ error: 'User not found' })
    }
    return res.json({ user: users[0] })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
