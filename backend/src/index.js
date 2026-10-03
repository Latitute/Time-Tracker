import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import authRoutes from './routes/auth.js'
import taskRoutes from './routes/tasks.js'
import timeEntryRoutes from './routes/time-entries.js'
import scheduledTaskRoutes from './routes/scheduled-tasks.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const app = express()
const port = Number(process.env.PORT || 3001)

app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())

app.get('/health', (req, res) => res.json({ status: 'ok' }))
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/time-entries', timeEntryRoutes)
app.use('/api/scheduled-tasks', scheduledTaskRoutes)

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  console.error(error)
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Email is already registered' })
  }
  return res.status(500).json({ error: 'Internal server error' })
})

app.listen(port, '0.0.0.0', () => console.log(`Server running on port ${port}`))
