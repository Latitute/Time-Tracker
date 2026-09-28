import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTimer } from '../hooks/useTimer.js'
import { task, timeEntry } from '../services/api.js'
import { formatTime, formatDuration, todayDate, nowDateTime } from '../utils/format-time.js'
import styles from './TimerPage.module.css'

const COLORS = ['#4361EE', '#06D6A0', '#EF476F', '#FFD166', '#118AB2', '#073B4C', '#8338EC', '#FB5607']

export default function TimerPage() {
  const { token } = useAuth()   
  const timer = useTimer()       

  const [tasks, setTasks] = useState([])          
  const [selectedTaskId, setSelectedTaskId] = useState('') 
  const [activeEntryId, setActiveEntryId] = useState(null) 
  const [todayEntries, setTodayEntries] = useState([])     
  const [starting, setStarting] = useState(false)           
  const [showQuickForm, setShowQuickForm] = useState(false) 
  const [quickTitle, setQuickTitle] = useState('')          
  const [quickColor, setQuickColor] = useState(COLORS[0])   

  useEffect(() => {
    loadData()
  }, [token])

  async function loadData() {
    const [taskList, entries] = await Promise.all([
      task.list(token),
      timeEntry.list(token, todayDate())
    ])
    setTasks(taskList)
    setTodayEntries(entries)

    const active = entries.find(e => !e.end_time)
    if (active) {
      const entryDate = active.start_time.slice(0, 10)
      if (entryDate === todayDate()) {
        const [h, m, s] = active.start_time.slice(11, 19).split(':').map(Number)
        const startMs = new Date().setHours(h, m, s, 0)
        const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000))
        timer.start(elapsed)
        setActiveEntryId(active.id)
        setSelectedTaskId(active.task_id || '')
      } else {
        const stopTime = entryDate + ' 23:59:59'
        await timeEntry.update(token, active.id, { end_time: stopTime })
        const refreshed = await timeEntry.list(token, todayDate())
        setTodayEntries(refreshed)
      }
    }
  }

  async function handleQuickCreate(e) {
    e.preventDefault()
    if (!quickTitle.trim()) return
    const newTask = await task.create(token, { title: quickTitle, color: quickColor })
    setTasks(prev => [...prev, newTask]) 
    setSelectedTaskId(newTask.id)        
    setQuickColor(COLORS[0])
    setShowQuickForm(false)
  }

  async function handleStart() {
    if (!selectedTaskId) return
    setStarting(true)
    try {
      const entry = await timeEntry.create(token, {
        task_id: selectedTaskId,
        start_time: nowDateTime(),
        date: todayDate()
      })
      setActiveEntryId(entry.id)
      timer.start(0) // Bắt đầu đếm từ 0
    } catch (err) {
      if (err.status === 409) alert('Bạn đã có bản ghi đang chạy')
    } finally {
      setStarting(false)
    }
  }


  async function handleStop() {
    if (!activeEntryId) return
    await timeEntry.update(token, activeEntryId, { end_time: nowDateTime() })
    timer.stop()
    timer.reset()
    setActiveEntryId(null)
    const entries = await timeEntry.list(token, todayDate())
    setTodayEntries(entries)
  }

  const getTaskTitle = (taskId) => tasks.find(t => t.id === taskId)?.title || 'Không rõ'
  const getTaskColor = (taskId) => tasks.find(t => t.id === taskId)?.color || '#6C757D'

  return (
    <div className={styles.page}>
      <div className={styles.timerSection}>
        {/* Dòng chọn công việc */}
        <div className={styles.taskRow}>
          <select
            className={styles.taskSelect}
            value={selectedTaskId}
            onChange={e => setSelectedTaskId(e.target.value)}
            disabled={timer.isRunning}  // Không đổi công việc khi đang chạy
          >
            <option value="">-- Choosse task --</option>
            {tasks.map(t => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          {/* Nút "+" để tạo nhanh công việc mới */}
          {!timer.isRunning && (
            <button className={styles.quickBtn} onClick={() => setShowQuickForm(f => !f)}>
              {showQuickForm ? 'X' : '+'}
            </button>
          )}
        </div>

        {/* Form tạo nhanh công việc */}
        {showQuickForm && (
          <form className={styles.quickForm} onSubmit={handleQuickCreate}>
            <input
              type="text"
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              placeholder="New task..."
              className={styles.quickInput}
              required
            />
            {/* Chọn màu cho công việc */}
            <div className={styles.colorRow}>
              {COLORS.map(c => (
                <button
                  key={c} type="button"
                  className={`${styles.colorDot} ${c === quickColor ? styles.colorSelected : ''}`}
                  style={{ background: c }}
                  onClick={() => setQuickColor(c)}
                />
              ))}
            </div>
            <button type="submit" className={styles.quickSave}>Tạo & chọn</button>
          </form>
        )}

        {/* Hiển thị đồng hồ đếm */}
        <div className={`${styles.timerDisplay} ${timer.isRunning ? styles.running : ''}`}>
          {formatTime(timer.seconds)}
        </div>

        {/* Nút bắt đầu / dừng */}
        {timer.isRunning ? (
          <button className={styles.stopBtn} onClick={handleStop}>Dừng lại</button>
        ) : (
          <button className={styles.startBtn} onClick={handleStart}
            disabled={!selectedTaskId || starting}>
            {starting ? 'Start...' : 'Start'}
          </button>
        )}
      </div>

      {/* Danh sách bản ghi trong ngày */}
      <div className={styles.logSection}>
        <h3 className={styles.logTitle}>Today</h3>
        {todayEntries.length === 0 ? (
          <p className={styles.empty}>No record</p>
        ) : (
          <ul className={styles.logList}>
            {/* Chỉ hiện bản ghi đã kết thúc (có end_time) */}
            {todayEntries.filter(e => e.end_time).map(entry => (
              <li key={entry.id} className={styles.logItem}>
                {/* Chấm tròn màu của công việc */}
                <span className={styles.dot} style={{ background: getTaskColor(entry.task_id) }} />
                {/* Tên công việc */}
                <span className={styles.logTask}>{entry.task_title || getTaskTitle(entry.task_id)}</span>
                {/* Khoảng thời gian (VD: 09:00 - 10:30) */}
                <span className={styles.logTime}>
                  {entry.start_time?.slice(11, 16)} - {entry.end_time?.slice(11, 16)}
                </span>
                {/* Thời lượng (VD: 1h 30m) */}
                <span className={styles.logDuration}>{formatDuration(entry.duration)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
