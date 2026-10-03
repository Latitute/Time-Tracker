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
      return res.status(400).json({ error: 'Please fill in all the information.' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'The password must have at least 6 characters.' })
    }
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' })
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
      return res.status(409).json({ error: 'Used Email' })
    }
    res.status(500).json({ error: 'Server Error' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter your email and password' })
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()])

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Incorrect email or password' })
    }

    const user = rows[0]

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect email or password' })
    }

    const token = signToken(user)
    res.json({ user: { id: user.id, name: user.name, email: user.email }, token })
  } catch {
    res.status(500).json({ error: 'Server Error' })
  }
})

router.get('/me', async (req, res) => {
  const auth = req.headers.authorization

  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not Login yet' })
  }

  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET)

    const [rows] = await pool.execute('SELECT id, name, email FROM users WHERE id = ?', [decoded.id])

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Error find user' })
    }

    res.json({ user: rows[0] })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

export default router
