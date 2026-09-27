require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const authRoutes = require('./routes/auth')

const app = express()
const port = Number(process.env.PORT || 3001)

app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error)
  }

  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'Email is already registered' })
  }

  console.error(error)
  return res.status(500).json({ message: 'Internal server error' })
})

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Backend API listening on port ${port}`)
  })
}

module.exports = app