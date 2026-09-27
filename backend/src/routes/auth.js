const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../config/db')

const router = express.Router()

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }

  return process.env.JWT_SECRET
}

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email }
}

router.post('/register', async (req, res, next) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body.password === 'string' ? req.body.password : ''

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' })
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' })
  }

  try {
    const [existingUsers] = await pool.execute('SELECT id FROM users WHERE email = ?', [email])
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Email is already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash],
    )
    const user = { id: result.insertId, name, email }

    return res.status(201).json({ user, token: createToken(user) })
  } catch (error) {
    return next(error)
  }
})

router.post('/login', async (req, res, next) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body.password === 'string' ? req.body.password : ''

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  try {
    const [users] = await pool.execute(
      'SELECT id, name, email, password_hash FROM users WHERE email = ?',
      [email],
    )
    const user = users[0]
    const passwordMatches = user && await bcrypt.compare(password, user.password_hash)

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const safeUser = publicUser(user)
    return res.json({ user: safeUser, token: createToken(safeUser) })
  } catch (error) {
    return next(error)
  }
})

router.get('/me', require('../middleware/auth'), async (req, res, next) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, name, email FROM users WHERE id = ?',
      [req.user.id],
    )
    const user = users[0]

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json({ user })
  } catch (error) {
    return next(error)
  }
})

module.exports = router