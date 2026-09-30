import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTimer } from '../hooks/useTimer.js'
import { task, timeEntry, timer as timerApi } from '../services/api.js'
import { formatTime, formatDuration, formatLocalTime, todayDate } from '../utils/format-time.js'
import styles from './TimerPage.module.css'

const DURATION_PRESETS = [5, 10, 15, 25, 30, 45, 60]

function getEntryStatus(entry) {
  if (entry.end_time) return 'done'
  if (!entry.end_time && entry.start_time) return 'running'
  return 'upcoming'
}

function statusLabel(status) {
  if (status === 'done')    return 'Đã kết thúc'
  if (status === 'running') return 'Đang thực hiện'
  return 'Sắp tới'
}

export default function TimerPage() {
  const { token } = useAuth()
  const countdown = useTimer()

  const [tasks, setTasks]               = useState([])
  const [todayEntries, setTodayEntries] = useState([])

  const [activeEntryId, setActiveEntryId] = useState(null)
  const [starting, setStarting]           = useState(false)
  const [stopping, setStopping]           = useState(false)

  const [filterTaskId, setFilterTaskId] = useState('')

  const [hasTargetDuration, setHasTargetDuration] = useState(false)
  const [durationMinutes, setDurationMinutes]     = useState(25)

  const [showQuickForm, setShowQuickForm] = useState(false)
  const [quickTitle, setQuickTitle]       = useState('')
  const [quickDesc, setQuickDesc]         = useState('')

  const [notification, setNotification] = useState(null)
  const expiredHandledRef = useRef(false)
  const notifTimerRef = useRef(null)

  const showNotification = useCallback((msg, durationMs = 8000) => {
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current)
    setNotification(msg)
    notifTimerRef.current = setTimeout(() => setNotification(null), durationMs)
  }, [])

  useEffect(() => () => {
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current)
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [taskList, entries, active] = await Promise.all([
        task.list(token),
        timeEntry.list(token, todayDate()),
        timerApi.active(token),
      ])
      setTasks(taskList)
      setTodayEntries(entries)

      if (active) {
        setActiveEntryId(active.id)
        setFilterTaskId(String(active.task_id || ''))
        expiredHandledRef.current = false

        const isCountdown = active.target_duration > 0
        setHasTargetDuration(isCountdown)

        try {
          if (isCountdown) {
            countdown.start(active.target_duration, active.start_time)
          } else {
            countdown.startUp(active.start_time)
          }
        } catch (timerErr) {
          console.error('[TimerPage] Invalid start_time from server:', timerErr)
          showNotification('Không thể khôi phục timer. Vui lòng tải lại trang.')
          setActiveEntryId(null)
        }
      }
    } catch (err) {
      console.error('[TimerPage loadData]', err)
    }
  }, [token])

  useEffect(() => { loadData() }, [token])

  useEffect(() => {
    if (!countdown.isExpired || expiredHandledRef.current) return
    expiredHandledRef.current = true
    setStopping(true)

    const taskTitle = tasks.find(t => t.id === Number(filterTaskId))?.title
      || todayEntries.find(e => e.id === activeEntryId)?.task_title
      || 'công việc'

    showNotification(`⏰ Hết giờ! Đang lưu kết quả...`, 30_000)

    timerApi.stop(token)
      .then(async () => {
        countdown.reset()
        setActiveEntryId(null)
        setHasTargetDuration(false)
        const entries = await timeEntry.list(token, todayDate())
        setTodayEntries(entries)
        showNotification(`⏰ Hết giờ! Công việc "${taskTitle}" đã hoàn thành.`)
      })
      .catch(err => {
        console.warn('[TimerPage auto-stop]', err)
        expiredHandledRef.current = false
        showNotification('Không thể lưu kết quả tự động. Vui lòng bấm "Dừng lại" để thử lại.')
      })
      .finally(() => setStopping(false))
  }, [countdown.isExpired])

  async function handleQuickCreate(e) {
    e.preventDefault()
    if (!quickTitle.trim()) return
    try {
      const created = await task.create(token, {
        title:       quickTitle.trim(),
        description: quickDesc.trim(),
      })
      setQuickTitle('')
      setQuickDesc('')
      setShowQuickForm(false)
      const taskList = await task.list(token)
      setTasks(taskList)
      if (created?.id) setFilterTaskId(String(created.id))
    } catch (err) {
      showNotification(`Không thể tạo công việc: ${err.message || 'Lỗi không xác định'}`)
    }
  }

  async function handleStart() {
    if (!filterTaskId) return
    setStarting(true)
    setNotification(null)
    expiredHandledRef.current = false
    try {
      const targetSeconds = hasTargetDuration ? durationMinutes * 60 : null

      const entry = await timerApi.start(token, {
        task_id:         Number(filterTaskId),
        target_duration: targetSeconds,
      })
      setActiveEntryId(entry.id)

      try {
        if (hasTargetDuration) {
          countdown.start(entry.target_duration, entry.start_time)
        } else {
          countdown.startUp(entry.start_time)
        }
      } catch (timerErr) {
        console.error('[TimerPage handleStart] Invalid start_time:', timerErr)
        showNotification('Timer đã tạo nhưng không thể hiển thị. Vui lòng tải lại trang.')
      }
    } catch (err) {
      if (err.status === 409) showNotification('Bạn đã có bản ghi đang chạy.')
      else if (err.status === 408) showNotification('Máy chủ không phản hồi. Vui lòng thử lại.')
      else showNotification(`Không thể bắt đầu: ${err.message || 'Lỗi không xác định'}`)
    } finally {
      setStarting(false)
    }
  }

  async function handleStop() {
    if (!activeEntryId || stopping) return
    setStopping(true)
    countdown.stop()
    try {
      await timerApi.stop(token)

      countdown.reset()
      setActiveEntryId(null)
      setHasTargetDuration(false)
      const entries = await timeEntry.list(token, todayDate())
      setTodayEntries(entries)
    } catch (err) {
      console.warn('[handleStop]', err)
      if (err.status === 408) {
        showNotification('Máy chủ không phản hồi. Timer vẫn đang chạy — vui lòng thử lại.')
      } else {
        showNotification(`Không thể dừng timer: ${err.message || 'Lỗi không xác định'}`)
      }
      await loadData().catch(() => {})
    } finally {
      setStopping(false)
    }
  }

  const isRunning  = countdown.isRunning
  const activeTask = tasks.find(t => t.id === Number(filterTaskId))

  const displaySeconds = hasTargetDuration
    ? countdown.remainingSeconds
    : countdown.elapsedSeconds

  const timerColorClass =
    countdown.isExpired                                                         ? styles.timerExpired
    : hasTargetDuration && countdown.isRunning && countdown.remainingSeconds <= 60  ? styles.timerDanger
    : hasTargetDuration && countdown.isRunning && countdown.remainingSeconds <= 300 ? styles.timerWarning
    : countdown.isRunning                                                       ? styles.timerRunning
    : ''

  const displayedEntries = todayEntries
    .slice()
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))

  return (
    <div className={styles.page}>

      {notification && (
        <div className={styles.notification}>
          <span>{notification}</span>
          <button className={styles.notifClose} onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      <div className={styles.timerSection}>

        <div className={styles.taskRow}>
          <select
            className={styles.taskSelect}
            value={filterTaskId}
            onChange={e => setFilterTaskId(e.target.value)}
            disabled={isRunning}
          >
            <option value="">-- Chọn công việc --</option>
            {tasks.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          <button
            className={styles.quickBtn}
            onClick={() => setShowQuickForm(f => !f)}
            title="Tạo công việc mới"
            disabled={isRunning}
          >
            {showQuickForm ? '✕' : '+'}
          </button>
        </div>

        {showQuickForm && (
          <form className={styles.quickForm} onSubmit={handleQuickCreate}>
            <input
              className={styles.quickInput}
              type="text"
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              placeholder="Tên công việc..."
              required autoFocus
            />
            <textarea
              className={styles.quickTextarea}
              value={quickDesc}
              onChange={e => setQuickDesc(e.target.value)}
              placeholder="Mô tả (tuỳ chọn)..."
              rows={2}
            />
            <div className={styles.quickActions}>
              <button type="submit" className={styles.quickSave}>Tạo &amp; chọn</button>
              <button type="button" className={styles.quickCancel}
                onClick={() => setShowQuickForm(false)}>Huỷ</button>
            </div>
          </form>
        )}

        {activeTask && !showQuickForm && (
          <p className={styles.runningTitle}>
            <span
              className={styles.runningDot}
              style={{ background: activeTask.color || '#4361EE' }}
            />
            {activeTask.title}
          </p>
        )}

        {!isRunning && (
          <label className={styles.durationToggle}>
            <input
              type="checkbox"
              checked={hasTargetDuration}
              onChange={e => setHasTargetDuration(e.target.checked)}
            />
            Đặt thời lượng (đếm ngược)
          </label>
        )}

        {!isRunning && hasTargetDuration && (
          <div className={styles.durationRow}>
            <div className={styles.durationInputs}>
              <input
                type="number" min={1} max={480}
                className={styles.durationNumber}
                value={durationMinutes}
                onChange={e => setDurationMinutes(Math.max(1, Number(e.target.value)))}
              />
              <span className={styles.durationUnit}>phút</span>
            </div>
            <div className={styles.presets}>
              {DURATION_PRESETS.map(m => (
                <button key={m} type="button"
                  className={`${styles.presetBtn} ${durationMinutes === m ? styles.presetActive : ''}`}
                  onClick={() => setDurationMinutes(m)}
                >{m}m</button>
              ))}
            </div>
          </div>
        )}

        <div className={`${styles.timerDisplay} ${timerColorClass}`}>
          {formatTime(displaySeconds)}
        </div>

        {isRunning || countdown.isExpired ? (
          <button
            className={styles.stopBtn}
            onClick={handleStop}
            disabled={stopping}
          >
            {stopping ? 'Đang dừng...' : 'Dừng lại'}
          </button>
        ) : (
          <button
            className={styles.startBtn}
            onClick={handleStart}
            disabled={!filterTaskId || starting}
          >
            {starting ? 'Đang bắt đầu...' : 'Bắt đầu'}
          </button>
        )}
      </div>

      <div className={styles.logSection}>
        <h3 className={styles.logTitle}>Hôm nay</h3>

        {displayedEntries.length === 0 ? (
          <p className={styles.empty}>Chưa có bản ghi nào hôm nay.</p>
        ) : (
          <ul className={styles.logList}>
            {displayedEntries.map(entry => {
              const status   = getEntryStatus(entry)
              const dotColor = tasks.find(t => t.id === entry.task_id)?.color || '#4361EE'
              return (
                <li key={entry.id} className={styles.logItem}>
                  <span className={styles.dot} style={{ background: dotColor }} />
                  <span className={styles.logTask}>{entry.task_title || '—'}</span>
                  <span className={styles.logTime}>
                    {formatLocalTime(entry.start_time)}
                    {entry.end_time ? ` – ${formatLocalTime(entry.end_time)}` : ''}
                  </span>
                  <span className={styles.logDuration}>
                    {entry.duration != null ? formatDuration(entry.duration) : '—'}
                  </span>
                  <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
                    {statusLabel(status)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
