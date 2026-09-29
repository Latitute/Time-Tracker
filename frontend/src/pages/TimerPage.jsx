import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTimer } from '../hooks/useTimer.js'
import { task, timeEntry, timer as timerApi } from '../services/api.js'
import { formatTime, formatDuration, todayDate } from '../utils/format-time.js'
import styles from './TimerPage.module.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_LEVELS = [
  { value: 1, hex: '#4895EF', label: 'Không vội'  },
  { value: 2, hex: '#06D6A0', label: 'Bình thường' },
  { value: 3, hex: '#FFD166', label: 'Quan trọng'  },
  { value: 4, hex: '#FB5607', label: 'Gấp'         },
  { value: 5, hex: '#EF476F', label: 'Cấp thiết'   },
]

const DURATION_PRESETS = [5, 10, 15, 25, 30, 45, 60]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPriorityInfo(value = 1) {
  return PRIORITY_LEVELS.find(p => p.value === value) || PRIORITY_LEVELS[0]
}

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function TimerPage() {
  const { token } = useAuth()
  const countdown = useTimer()

  // Data
  const [tasks, setTasks]               = useState([])
  const [todayEntries, setTodayEntries] = useState([])

  // Timer state
  const [activeEntryId, setActiveEntryId]       = useState(null)
  const [starting, setStarting]                 = useState(false)

  // Công việc đang chọn
  const [filterTaskId, setFilterTaskId] = useState('')

  // Chế độ: có đặt thời lượng không?
  // false → stopwatch (đếm xuôi, không giới hạn)
  // true  → countdown (đếm ngược từ durationMinutes)
  const [hasTargetDuration, setHasTargetDuration] = useState(false)
  const [durationMinutes, setDurationMinutes]     = useState(25)

  // Form tạo task nhanh
  const [showQuickForm, setShowQuickForm] = useState(false)
  const [quickTitle, setQuickTitle]       = useState('')
  const [quickDesc, setQuickDesc]         = useState('')
  const [quickPriority, setQuickPriority] = useState(1)

  // Notification
  const [notification, setNotification] = useState(null)
  const expiredHandledRef = useRef(false)

  // ─── Load data + khôi phục timer đang chạy ────────────────────────────────

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

        if (isCountdown) {
          // Countdown: tính remaining từ start_time + target_duration
          countdown.start(active.target_duration, active.start_time)
        } else {
          // Stopwatch: tính elapsed từ start_time đến now
          const elapsed = Math.max(0, Math.floor(
            (Date.now() - new Date(active.start_time).getTime()) / 1000
          ))
          countdown.startUp(elapsed)
        }
      }
    } catch (err) {
      console.error('[TimerPage loadData]', err)
    }
  }, [token]) // eslint-disable-line

  useEffect(() => { loadData() }, [token])

  // ─── Auto-stop khi countdown về 0 ─────────────────────────────────────────
  // Chỉ kích hoạt ở chế độ countdown (isExpired không bao giờ true ở stopwatch)

  useEffect(() => {
    if (!countdown.isExpired || expiredHandledRef.current) return
    expiredHandledRef.current = true

    const taskTitle = tasks.find(t => t.id === Number(filterTaskId))?.title
      || todayEntries.find(e => e.id === activeEntryId)?.task_title
      || 'công việc'

    // Auto-stop: backend ghi end_time, actual duration, overtime
    timerApi.stop(token)
      .then(async () => {
        countdown.reset()
        setActiveEntryId(null)
        const entries = await timeEntry.list(token, todayDate())
        setTodayEntries(entries)
      })
      .catch(err => {
        console.warn('[TimerPage auto-stop]', err)
        countdown.reset()
        setActiveEntryId(null)
      })

    setNotification(`⏰ Hết giờ! Công việc "${taskTitle}" đã hoàn thành.`)
    setTimeout(() => setNotification(null), 8000)
  }, [countdown.isExpired]) // eslint-disable-line

  // ─── Tạo task nhanh ───────────────────────────────────────────────────────

  async function handleQuickCreate(e) {
    e.preventDefault()
    if (!quickTitle.trim()) return
    try {
      const created = await task.create(token, {
        title:       quickTitle.trim(),
        description: quickDesc.trim(),
        priority:    quickPriority,
        color:       getPriorityInfo(quickPriority).hex,
      })
      setQuickTitle('')
      setQuickDesc('')
      setQuickPriority(1)
      setShowQuickForm(false)
      const taskList = await task.list(token)
      setTasks(taskList)
      // Tự động chọn task vừa tạo
      if (created?.id) setFilterTaskId(String(created.id))
    } catch (err) {
      console.error('[handleQuickCreate]', err)
    }
  }

  // ─── Start timer ──────────────────────────────────────────────────────────

  async function handleStart() {
    if (!filterTaskId) return
    setStarting(true)
    setNotification(null)
    expiredHandledRef.current = false
    try {
      // Nếu không đặt thời lượng → gửi null (stopwatch mode)
      // Nếu đặt thời lượng → gửi số giây (countdown mode)
      const targetSeconds = hasTargetDuration ? durationMinutes * 60 : null

      const entry = await timerApi.start(token, {
        task_id:         Number(filterTaskId),
        target_duration: targetSeconds,
      })
      setActiveEntryId(entry.id)

      if (hasTargetDuration) {
        countdown.start(entry.target_duration, entry.start_time)
      } else {
        countdown.startUp(0)
      }
    } catch (err) {
      if (err.status === 409) setNotification('Bạn đã có bản ghi đang chạy.')
      else setNotification('Không thể bắt đầu. Vui lòng thử lại.')
    } finally {
      setStarting(false)
    }
  }

  // ─── Stop timer (thủ công) ────────────────────────────────────────────────

  async function handleStop() {
    if (!activeEntryId) return
    countdown.stop()
    try {
      await timerApi.stop(token)
    } catch (err) {
      console.warn('[handleStop]', err)
    }
    countdown.reset()
    setActiveEntryId(null)
    setHasTargetDuration(false)
    const entries = await timeEntry.list(token, todayDate())
    setTodayEntries(entries)
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const isRunning  = countdown.isRunning || countdown.isExpired
  const activeTask = tasks.find(t => t.id === Number(filterTaskId))

  // Số giây hiển thị:
  //   countdown mode → remaining (giảm dần)
  //   stopwatch mode → elapsed  (tăng dần)
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Notification banner ── */}
      {notification && (
        <div className={styles.notification}>
          <span>{notification}</span>
          <button className={styles.notifClose} onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      {/* ── Timer section ── */}
      <div className={styles.timerSection}>

        {/* Chọn công việc */}
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

        {/* ── Form tạo task nhanh ── */}
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

            {/* Mức độ ưu tiên */}
            <div className={styles.prioritySection}>
              <label className={styles.fieldLabel}>Mức độ ưu tiên</label>
              <div className={styles.priorityBar}>
                <div className={styles.priorityTrack} />
                <div className={styles.priorityDots}>
                  {PRIORITY_LEVELS.map(p => (
                    <button
                      key={p.value} type="button"
                      className={`${styles.priorityDot} ${quickPriority === p.value ? styles.prioritySelected : ''}`}
                      style={{ '--dot-color': p.hex }}
                      onClick={() => setQuickPriority(p.value)}
                      title={p.label}
                    />
                  ))}
                </div>
                <div className={styles.priorityEndLabels}>
                  <span>Không vội</span>
                  <span>Cấp thiết</span>
                </div>
              </div>
              <p className={styles.priorityCurrent} style={{ color: getPriorityInfo(quickPriority).hex }}>
                {getPriorityInfo(quickPriority).label}
              </p>
            </div>

            <div className={styles.quickActions}>
              <button type="submit" className={styles.quickSave}>Tạo &amp; chọn</button>
              <button type="button" className={styles.quickCancel}
                onClick={() => setShowQuickForm(false)}>Huỷ</button>
            </div>
          </form>
        )}

        {/* Tên task đang chọn/chạy */}
        {activeTask && !showQuickForm && (
          <p className={styles.runningTitle}>
            <span
              className={styles.runningDot}
              style={{ background: getPriorityInfo(activeTask.priority).hex }}
            />
            {activeTask.title}
          </p>
        )}

        {/* ── Toggle đặt thời lượng (chỉ hiện khi chưa chạy) ── */}
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

        {/* ── Picker thời lượng (chỉ hiện khi bật toggle và chưa chạy) ── */}
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

        {/* ── Đồng hồ ── */}
        <div className={`${styles.timerDisplay} ${timerColorClass}`}>
          {formatTime(displaySeconds)}
        </div>

        {/* ── Nút Start / Stop ── */}
        {isRunning ? (
          <button className={styles.stopBtn} onClick={handleStop}>Dừng lại</button>
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

      {/* ── Log hôm nay ── */}
      <div className={styles.logSection}>
        <h3 className={styles.logTitle}>Hôm nay</h3>

        {displayedEntries.length === 0 ? (
          <p className={styles.empty}>Chưa có bản ghi nào hôm nay.</p>
        ) : (
          <ul className={styles.logList}>
            {displayedEntries.map(entry => {
              const status = getEntryStatus(entry)
              const pColor = getPriorityInfo(
                tasks.find(t => t.id === entry.task_id)?.priority
              ).hex
              return (
                <li key={entry.id} className={styles.logItem}>
                  <span className={styles.dot} style={{ background: pColor }} />
                  <span className={styles.logTask}>{entry.task_title || '—'}</span>
                  <span className={styles.logTime}>
                    {entry.start_time?.slice(11, 16)}
                    {entry.end_time ? ` – ${entry.end_time.slice(11, 16)}` : ''}
                  </span>
                  <span className={styles.logDuration}>
                    {entry.duration ? formatDuration(entry.duration) : '—'}
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
