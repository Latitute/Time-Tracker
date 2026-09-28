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
app.use(helmet())
app.use(cors({
  origin: ['http://localhost:5173', 'https://toms-mac-mini.taile1277c.ts.net'],
  credentials: true,
}))
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/time-entries', timeEntryRoutes)
app.use('/api/scheduled-tasks', scheduledTaskRoutes)

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server errror' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`))
