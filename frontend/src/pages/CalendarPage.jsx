import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { timeEntry, scheduledTask, task } from '../services/api.js'
import { formatDuration } from '../utils/format-time.js'
import { getCalendarDays, getMonthName, formatDate, groupByDate } from '../utils/calendar-utils.js'
import { format, isToday } from 'date-fns'
import styles from './CalendarPage.module.css'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DURATION_OPTIONS = [
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '1h30', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 },
]

export default function CalendarPage() {
  const { token } = useAuth()

  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState(null)  

  const [entries, setEntries] = useState([])       
  const [scheduled, setScheduled] = useState([])    
  const [tasks, setTasks] = useState([])            
  const [loading, setLoading] = useState(false)
  const [showScheduleForm, setShowScheduleForm] = useState(false)

  const [formTaskId, setFormTaskId] = useState('')         
  const [formStartTime, setFormStartTime] = useState('09:00') 
  const [formDuration, setFormDuration] = useState(60)    
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    task.list(token).then(setTasks).catch(() => {})
  }, [token])

  const fetchMonthData = useCallback(async (year, month) => {
    if (!token) return
    setLoading(true)
    try {
      const days = getCalendarDays(year, month)
      const allDates = days.map(d => formatDate(d.date))
      const from = allDates[0]
      const to = allDates[allDates.length - 1]

      const [entryList, scheduledList] = await Promise.all([
        timeEntry.listRange(token, from, to),
        scheduledTask.listRange(token, from, to),
      ])
      setEntries(entryList)
      setScheduled(scheduledList)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchMonthData(currentYear, currentMonth)
  }, [currentYear, currentMonth, fetchMonthData])

  const entriesByDate = useMemo(
    () => groupByDate(entries, e => e.date),
    [entries],
  )
  
  const scheduledByDate = useMemo(
    () => groupByDate(scheduled, s => {
      if (!s.scheduled_date) return '';
      return typeof s.scheduled_date === 'string' 
        ? s.scheduled_date.slice(0, 10) 
        : new Date(s.scheduled_date).toISOString().slice(0, 10);
    }),
    [scheduled],
  )

  const calendarDays = useMemo(
    () => getCalendarDays(currentYear, currentMonth),
    [currentYear, currentMonth],
  )

  function goToPrevMonth() {
    setCurrentMonth(m => {
      if (m === 0) { setCurrentYear(y => y - 1); return 11 }
      return m - 1
    })
  }

  function goToNextMonth() {
    setCurrentMonth(m => {
      if (m === 11) { setCurrentYear(y => y + 1); return 0 }
      return m + 1
    })
  }

  function goToToday() {
    const now = new Date()
    setCurrentYear(now.getFullYear())
    setCurrentMonth(now.getMonth())
    setSelectedDate(formatDate(now))
  }

  function getTaskTitle(taskId) {
    return tasks.find(t => t.id === taskId)?.title || 'Unknown'
  }

  function getTaskColor(taskId) {
    return tasks.find(t => t.id === taskId)?.color || '#6C757D'
  }

  async function handleToggleComplete(item) {
    try {
      const updated = await scheduledTask.update(token, item.id, {
        is_completed: !item.is_completed, 
      })
      setScheduled(prev => prev.map(s => (s.id === item.id ? { ...s, ...updated } : s)))
    } catch {
    }
  }

  async function handleDeleteScheduled(id) {
    if (!confirm('Are you sure to delete this task?')) return
    try {
      await scheduledTask.delete(token, id)
      setScheduled(prev => prev.filter(s => s.id !== id))
    } catch {
    }
  }

  async function handleCreateScheduled(e) {
    e.preventDefault()
    if (!formTaskId || !selectedDate) return
    setSubmitting(true)
    try {
      const [hours, minutes] = formStartTime.split(':').map(Number)
      
      const timeOnly = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
      
      await scheduledTask.create(token, {
        task_id: Number(formTaskId),           
        scheduled_date: selectedDate,          
        start_time: timeOnly,                  
        estimated_duration: formDuration * 60, 
      })
      
      setShowScheduleForm(false)
      setFormTaskId('')
      setFormStartTime('09:00')
      setFormDuration(60)
      
      await fetchMonthData(currentYear, currentMonth)
    } catch (error) {
      console.error("Error creating task:", error);
      alert("Không thể tạo lịch hẹn, hãy kiểm tra Console F12!");
    } finally {
      setSubmitting(false)
    }
  }

  const selectedDateEntries = selectedDate ? (entriesByDate[selectedDate] || []) : []
  const selectedDateScheduled = selectedDate ? (scheduledByDate[selectedDate] || []) : []
  
  const formattedSelectedDate = selectedDate
    ? format(new Date(selectedDate + 'T00:00:00'), 'EEEE, dd/MM/yyyy')
    : ''

  return (
    <div className={styles.page}>
      {/* Điều hướng tháng */}
      <div className={styles.monthNav}>
        <button className={styles.navBtn} onClick={goToPrevMonth} aria-label="Last week">&#8249;</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span className={styles.monthTitle}>
            {getMonthName(currentMonth)}, {currentYear}
          </span>
          <button className={styles.todayBtn} onClick={goToToday}>Today</button>
        </div>
        <button className={styles.navBtn} onClick={goToNextMonth} aria-label="Next week">&#8250;</button>
      </div>

      {/* Tiêu đề các ngày trong tuần */}
      <div className={styles.weekdayRow}>
        {WEEKDAYS.map(day => (
          <div key={day} className={styles.weekdayCell}>{day}</div>
        ))}
      </div>

      {/* Lưới lịch - 42 ô (6 hàng x 7 cột) */}
      <div className={styles.calendarGrid}>
        {calendarDays.map(({ date, isCurrentMonth }, idx) => {
          const dateStr = formatDate(date)
          const dayEntries = entriesByDate[dateStr] || []
          const dayScheduled = scheduledByDate[dateStr] || []
          const isTodayDate = isToday(date)
          const isSelected = dateStr === selectedDate

          // Hiện tối đa 3 chấm tròn màu (mỗi màu = 1 công việc)
          const uniqueColors = [...new Set(dayEntries.map(e => getTaskColor(e.task_id)))].slice(0, 3)
          const hasScheduled = dayScheduled.length > 0

          return (
            <div
              key={idx}
              className={`${styles.dayCell} ${!isCurrentMonth ? styles.otherMonth : ''} ${isTodayDate ? styles.today : ''} ${isSelected ? styles.selected : ''}`}
              onClick={() => setSelectedDate(dateStr)}
            >
              <div className={styles.dayNumber}>{date.getDate()}</div>
              <div className={styles.dayIndicators}>
                {/* Chấm tròn = có bản ghi thời gian */}
                {uniqueColors.map((color, ci) => (
                  <span key={ci} className={styles.entryDot} style={{ background: color }} />
                ))}
                {/* Gạch ngang = có lịch hẹn */}
                {hasScheduled && <span className={styles.scheduledDash} />}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bảng chi tiết ngày đã chọn */}
      {selectedDate && (
        <div className={styles.dayPanel}>
          <div className={styles.dayPanelTitle}>
            <span>{formattedSelectedDate}</span>
            <button className={styles.addBtn} onClick={() => setShowScheduleForm(f => !f)}>
              {showScheduleForm ? 'Hủy' : '+ New task'}
            </button>
          </div>

          {/* Form tạo lịch hẹn */}
          {showScheduleForm && (
            <form className={styles.scheduleForm} onSubmit={handleCreateScheduled}>
              <div className={styles.formField}>
                <label>Công việc</label>
                <select value={formTaskId} onChange={e => setFormTaskId(e.target.value)} required>
                  <option value="">-- Chọn --</option>
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formField}>
                <label>Thời gian bắt đầu</label>
                <input
                  type="time"
                  value={formStartTime}
                  onChange={e => setFormStartTime(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formField}>
                <label>Thời lượng dự kiến</label>
                <select value={formDuration} onChange={e => setFormDuration(Number(e.target.value))}>
                  {DURATION_OPTIONS.map(opt => (
                    <option key={opt.minutes} value={opt.minutes}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className={styles.submitBtn} disabled={submitting || !formTaskId}>
                {submitting ? 'Đang lưu...' : 'Thêm lịch'}
              </button>
              <button type="button" className={styles.cancelFormBtn} onClick={() => setShowScheduleForm(false)}>
                Hủy
              </button>
            </form>
          )}

          {/* Danh sách bản ghi thời gian */}
          <div className={styles.sectionTitle}>Timeline ({selectedDateEntries.length})</div>
          {selectedDateEntries.length === 0 ? (
            <p className={styles.empty}>No record</p>
          ) : (
            <ul className={styles.entryList}>
              {selectedDateEntries.map(entry => (
                <li key={entry.id} className={styles.entryItem}>
                  <span className={styles.entryDotLarge} style={{ background: getTaskColor(entry.task_id) }} />
                  <span className={styles.entryTask}>{entry.task_title || getTaskTitle(entry.task_id)}</span>
                  <span className={styles.entryTime}>
                    {entry.start_time?.slice(11, 16)} - {entry.end_time?.slice(11, 16)}
                  </span>
                  <span className={styles.entryDuration}>{formatDuration(entry.duration)}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Danh sách lịch hẹn */}
          <div className={styles.sectionTitle}>Scheduled ({selectedDateScheduled.length})</div>
          {selectedDateScheduled.length === 0 ? (
            <p className={styles.empty}>No record</p>
          ) : (
            <ul className={styles.scheduledList}>
              {selectedDateScheduled.map(item => (
                <li key={item.id} className={`${styles.scheduledItem} ${item.is_completed ? styles.completed : ''}`}>
                  {/* Checkbox đánh dấu hoàn thành */}
                  <input
                    type="checkbox"
                    className={styles.scheduledCheckbox}
                    checked={!!item.is_completed}
                    onChange={() => handleToggleComplete(item)}
                    aria-label="Đánh dấu hoàn thành"
                  />
                  <div className={styles.scheduledInfo}>
                    <span className={styles.scheduledTaskName}>{getTaskTitle(item.task_id)}</span>
                    <span className={styles.scheduledTime}>
                      {/* Cắt chuỗi start_time để lấy định dạng HH:mm từ 09:00:00 */}
                      {' '}
                      {item.start_time?.slice(0, 5)}
                      
                      {/* Chuyển đổi giây thành giờ và phút để hiển thị */}
                      {item.estimated_duration ? (() => {
                        const totalMins = Math.floor(item.estimated_duration / 60);
                        const h = Math.floor(totalMins / 60);
                        const m = totalMins % 60;
                        if (h > 0 && m > 0) return ` (${h}h${m}p)`;
                        if (h > 0) return ` (${h}h)`;
                        return ` (${m}p)`;
                      })() : ''}
                    </span>
                  </div>
                  <button
                    className={styles.scheduledDeleteBtn}
                    onClick={() => handleDeleteScheduled(item.id)}
                    aria-label="Xóa lịch hẹn"
                  >
                    Xóa
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}