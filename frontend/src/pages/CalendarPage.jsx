import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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

const CATEGORY_OPTIONS = ['Study', 'Work', 'Exercise', 'Entertainment', 'Personal']

const COLOR_OPTIONS = [
  '#4C6EF5', 
  '#0CA678', 
  '#F03E3E', 
  '#FAB005', 
  '#1098AD', 
  '#0B7285', 
  '#7048E8', 
  '#F76707'  
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

  // --- FULL FORM STATES ---
  const [formTaskId, setFormTaskId] = useState('new')         
  const [formTaskName, setFormTaskName] = useState('')
  const [formScheduledDate, setFormScheduledDate] = useState('') 
  const [formStartTime, setFormStartTime] = useState('09:00') 
  
  // === THÊM STATE CHO DEADLINE ===
  const [formDeadlineDate, setFormDeadlineDate] = useState('')
  const [formDeadlineTime, setFormDeadlineTime] = useState('17:00') // Mặc định cuối ngày làm việc nghỉ ngơi
  
  const [formDuration, setFormDuration] = useState(60)    
  const [formCategory, setFormCategory] = useState('Study')
  const [formColor, setFormColor] = useState('#4C6EF5')
  const [submitting, setSubmitting] = useState(false)

  // Custom Dropdown Menu States for Task Name Combo-box
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close custom dropdown when clicking outside the element
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Synchronize default start date & deadline date when a user clicks a calendar cell
  useEffect(() => {
    if (selectedDate) {
      setFormScheduledDate(selectedDate)
      setFormDeadlineDate(selectedDate) // Đồng bộ ngày deadline mặc định trùng ngày bắt đầu
    }
  }, [selectedDate])

  // Fetch task templates list initially
  useEffect(() => {
    if (!token) return
    task.list(token).then(setTasks).catch(() => {})
  }, [token])

  // Handle live typing inside Task Name field
  const handleTaskNameTyping = (value) => {
    setFormTaskName(value)
    setIsDropdownOpen(true)

    // Check if what they typed exactly matches an existing task template
    const matchedTask = tasks.find(t => t.title?.toLowerCase() === value.toLowerCase().trim())
    if (matchedTask) {
      setFormTaskId(matchedTask.id)
      setFormColor(matchedTask.color || '#4C6EF5')
      setFormCategory(matchedTask.category || 'Study')
    } else {
      setFormTaskId('new')
    }
  }

  // Handle explicit selection from custom task dropdown menu
  const handleSelectTaskTemplate = (selectedTask) => {
    setFormTaskId(selectedTask.id)
    setFormTaskName(selectedTask.title || '')
    setFormColor(selectedTask.color || '#4C6EF5')
    setFormCategory(selectedTask.category || 'Study')
    setIsDropdownOpen(false)
  }

  // Filter tasks based on typing context inside dropdown menu
  const filteredTasks = useMemo(() => {
    if (!formTaskName.trim()) return tasks
    return tasks.filter(t => t.title?.toLowerCase().includes(formTaskName.toLowerCase()))
  }, [tasks, formTaskName])

  const fetchMonthData = useCallback(async (year, month) => {
    if (!token) return;
    setLoading(true);
    try {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const from = firstDay.toISOString().slice(0, 10);
      const to = lastDay.toISOString().slice(0, 10);

      const [entryList, scheduledList] = await Promise.all([
        timeEntry.listRange(token, from, to),
        scheduledTask.listRange(token, from, to),
      ]);
      setEntries(entryList);
      setScheduled(scheduledList);
    } catch (err) {
      console.error("Fetch data error:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

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
    if (!formScheduledDate || !formTaskName.trim()) return
    setSubmitting(true)
    try {
      // Format Start Time
      const [hours, minutes] = formStartTime.split(':').map(Number)
      const timeOnly = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
      
      // === FORMAT DEADLINE TIME (NẾU CÓ) ===
      let deadlineTimeOnly = undefined
      if (formDeadlineTime) {
        const [dlHours, dlMinutes] = formDeadlineTime.split(':').map(Number)
        deadlineTimeOnly = `${String(dlHours).padStart(2, '0')}:${String(dlMinutes).padStart(2, '0')}:00`
      }

      await scheduledTask.create(token, {
        task_id: formTaskId === 'new' ? null : Number(formTaskId),          
        new_task_title: formTaskId === 'new' ? formTaskName.trim() : undefined,
        category: formCategory,
        color: formColor,
        scheduled_date: formScheduledDate, 
        start_time: timeOnly,                  
        estimated_duration: formDuration * 60,
        
        // === GỬI THÊM TRƯỜNG DEADLINE LÊN BACKEND ===
        deadline_date: formDeadlineDate || null,
        deadline_time: deadlineTimeOnly || null
      })
      
      setShowScheduleForm(false)
      setFormTaskId('new')
      setFormTaskName('')
      setFormStartTime('09:00')
      setFormDeadlineTime('17:00')
      setFormDuration(60)
      
      await fetchMonthData(currentYear, currentMonth)
    } catch (error) {
      console.error("Error creating schedule:", error);
      alert("Failed to create schedule. Please check your inputs!");
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
      {/* Month Navigation Control */}
      <div className={styles.monthNav}>
        <button className={styles.navBtn} onClick={goToPrevMonth} aria-label="Last month">&#8249;</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span className={styles.monthTitle}>
            {getMonthName(currentMonth)}, {currentYear}
          </span>
          <button className={styles.todayBtn} onClick={goToToday}>Today</button>
        </div>
        <button className={styles.navBtn} onClick={goToNextMonth} aria-label="Next month">&#8250;</button>
      </div>

      {/* Weekdays Indicator */}
      <div className={styles.weekdayRow}>
        {WEEKDAYS.map(day => (
          <div key={day} className={styles.weekdayCell}>{day}</div>
        ))}
      </div>

      {/* Main Calendar View Grid */}
      <div className={styles.calendarGrid}>
        {calendarDays.map(({ date, isCurrentMonth }, idx) => {
          const dateStr = formatDate(date)
          const dayEntries = entriesByDate[dateStr] || []
          const dayScheduled = scheduledByDate[dateStr] || []
          const isTodayDate = isToday(date)
          const isSelected = dateStr === selectedDate

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
                {uniqueColors.map((color, ci) => (
                  <span key={ci} className={styles.entryDot} style={{ background: color }} />
                ))}
                {hasScheduled && <span className={styles.scheduledDash} />}
              </div>
            </div>
          )
        })}
      </div>

      {/* Day Panel View Operations */}
      {selectedDate && (
        <div className={styles.dayPanel}>
          <div className={styles.dayPanelTitle}>
            <span>{formattedSelectedDate}</span>
            <button className={styles.addBtn} onClick={() => setShowScheduleForm(f => !f)}>
              {showScheduleForm ? 'Cancel' : '+ New task'}
            </button>
          </div>

          {showScheduleForm && (
            <form className={styles.scheduleForm} onSubmit={handleCreateScheduled}>
              
              {/* 1. CUSTOM TASK NAME COMBO-BOX */}
              <div className={styles.formField} ref={dropdownRef} style={{ position: 'relative' }}>
                <label>Task Name</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Type name or select template..."
                    value={formTaskName}
                    onChange={e => handleTaskNameTyping(e.target.value)}
                    onFocus={() => setIsDropdownOpen(true)}
                    required
                    style={{ width: '100%', paddingRight: '30px' }}
                  />
                  <span 
                    style={{ position: 'absolute', right: '10px', cursor: 'pointer', opacity: 0.6, fontSize: '12px' }}
                    onClick={() => setIsDropdownOpen(prev => !prev)}
                  >
                    ▼
                  </span>
                </div>

                {/* Custom Options List */}
                {isDropdownOpen && filteredTasks.length > 0 && (
                  <ul style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#ffffff',
                    border: '1px solid #ccc',
                    borderRadius: '6px',
                    boxShadow: '0px 4px 12px rgba(0,0,0,0.1)',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    zIndex: 100,
                    margin: '4px 0 0 0',
                    padding: '6px 0',
                    listStyle: 'none'
                  }}>
                    {filteredTasks.map(t => (
                      <li
                        key={t.id}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px',
                          backgroundColor: '#ffffff'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f3f5'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
                        onClick={() => handleSelectTaskTemplate(t)}
                      >
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: t.color || '#ccc' }} />
                        <span>{t.title}</span>
                        <span style={{ fontSize: '11px', color: '#868e96', marginLeft: 'auto' }}>({t.category || 'General'})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 2. START DATE */}
              <div className={styles.formField}>
                <label>Start Date</label>
                <input
                  type="date"
                  value={formScheduledDate}
                  onChange={e => setFormScheduledDate(e.target.value)}
                  required
                />
              </div>

              {/* 3. START TIME */}
              <div className={styles.formField}>
                <label>Start Time</label>
                <input
                  type="time"
                  value={formStartTime}
                  onChange={e => setFormStartTime(e.target.value)}
                  required
                />
              </div>

              {/* === BỔ SUNG THÊM: 4. DEADLINE DATE === */}
              <div className={styles.formField}>
                <label>Deadline Date</label>
                <input
                  type="date"
                  value={formDeadlineDate}
                  onChange={e => setFormDeadlineDate(e.target.value)}
                />
              </div>

              {/* === BỔ SUNG THÊM: 5. DEADLINE TIME === */}
              <div className={styles.formField}>
                <label>Deadline Time</label>
                <input
                  type="time"
                  value={formDeadlineTime}
                  onChange={e => setFormDeadlineTime(e.target.value)}
                />
              </div>

              {/* 6. ESTIMATE TIME */}
              <div className={styles.formField}>
                <label>Estimate Time</label>
                <select value={formDuration} onChange={e => setFormDuration(Number(e.target.value))}>
                  {DURATION_OPTIONS.map(opt => (
                    <option key={opt.minutes} value={opt.minutes}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* 7. CATEGORY */}
              <div className={styles.formField}>
                <label>Category</label>
                <select 
                  value={formCategory} 
                  onChange={e => setFormCategory(e.target.value)}
                  disabled={formTaskId !== 'new'}
                >
                  {CATEGORY_OPTIONS.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* 8. COLOR PICKER */}
              <div className={styles.formField}>
                <label>Color</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color}
                      type="button"
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: formColor === color ? '3px solid #1a1a1a' : '1px solid #ccc',
                        cursor: formTaskId !== 'new' ? 'not-allowed' : 'pointer',
                        transform: formColor === color ? 'scale(1.15)' : 'none',
                        transition: 'all 0.2s ease',
                        opacity: formTaskId !== 'new' && formColor !== color ? 0.4 : 1
                      }}
                      onClick={() => {
                        if (formTaskId === 'new') setFormColor(color)
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* FORM BUTTON OPERATIONS */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                  {submitting ? 'Saving...' : 'Add Schedule'}
                </button>
                <button type="button" className={styles.cancelFormBtn} onClick={() => setShowScheduleForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Timeline List */}
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

          {/* Scheduled List */}
          <div className={styles.sectionTitle}>Scheduled ({selectedDateScheduled.length})</div>
          {selectedDateScheduled.length === 0 ? (
            <p className={styles.empty}>No record</p>
          ) : (
            <ul className={styles.scheduledList}>
              {selectedDateScheduled.map(item => (
                <li key={item.id} className={styles.scheduledItem}>
                  <span 
                    className={styles.bulletDot} 
                    style={{ backgroundColor: item.task_color || '#4C6EF5' }} 
                  />
                  
                  <div className={styles.scheduledInfo}>
                    <span className={styles.scheduledTaskName}>
                      {item.task_title || getTaskTitle(item.task_id)}
                    </span>
                    <span className={styles.scheduledTime}>
                      {item.start_time?.slice(0, 5)}
                      {item.estimated_duration ? (() => {
                        const totalMins = Math.floor(item.estimated_duration / 60);
                        const h = Math.floor(totalMins / 60);
                        const m = totalMins % 60;
                        if (h > 0 && m > 0) return ` (${h}h ${m}m)`;
                        if (h > 0) return ` (${h}h)`;
                        return ` (${m}m)`;
                      })() : ''}
                    </span>
                  </div>
                  
                  <button
                    className={styles.scheduledDeleteBtn}
                    onClick={() => handleDeleteScheduled(item.id)}
                    aria-label="Delete schedule"
                  >
                    Delete
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