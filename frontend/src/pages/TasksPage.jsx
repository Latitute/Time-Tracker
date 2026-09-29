import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { task as taskApi, timeEntry } from '../services/api.js'
import { formatDuration } from '../utils/format-time.js'
import styles from './TasksPage.module.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_LEVELS = [
  { value: 1, hex: '#4895EF', label: 'Không vội'   },
  { value: 2, hex: '#06D6A0', label: 'Bình thường'  },
  { value: 3, hex: '#FFD166', label: 'Quan trọng'   },
  { value: 4, hex: '#FB5607', label: 'Gấp'          },
  { value: 5, hex: '#EF476F', label: 'Cấp thiết'    },
]

const SORT_OPTIONS = [
  { key: 'title',      label: 'Tên'                 },
  { key: 'created_at', label: 'Thời gian tạo'       },
  { key: 'start_time', label: 'Thời gian bắt đầu'  },
  { key: 'end_time',   label: 'Thời gian kết thúc' },
  { key: 'priority',   label: 'Mức ưu tiên'         },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPriorityInfo(value = 1) {
  return PRIORITY_LEVELS.find(p => p.value === value) || PRIORITY_LEVELS[0]
}

function getTaskStatus(task, latestEntry) {
  if (!latestEntry) return 'Chưa bắt đầu'
  if (!latestEntry.end_time) return 'Đang thực hiện'
  return 'Đã kết thúc'
}

function getStatusClass(task, latestEntry) {
  if (!latestEntry) return 'upcoming'
  if (!latestEntry.end_time) return 'running'
  return 'done'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { token } = useAuth()

  const [tasks, setTasks]         = useState([])
  const [entries, setEntries]     = useState([]) // tất cả time_entries
  const [showForm, setShowForm]   = useState(false)
  const [editTask, setEditTask]   = useState(null)

  // Form fields
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority]       = useState(1)

  // Sort
  const [sortBy, setSortBy]         = useState('created_at')
  const [sortDir, setSortDir]       = useState('asc')  // 'asc' | 'desc'
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortMenuRef = useRef(null)

  // ─── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => { loadAll() }, [token])

  async function loadAll() {
    try {
      const [taskList, entryList] = await Promise.all([
        taskApi.list(token),
        // Lấy 30 ngày gần nhất để có đủ dữ liệu
        fetchRecentEntries(),
      ])
      setTasks(taskList)
      setEntries(entryList)
    } catch (err) {
      console.error('[TasksPage loadAll]', err)
    }
  }

  async function fetchRecentEntries() {
    // Lấy từ ngày 30 ngày trước đến hôm nay
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 30)
    const fmt = d => d.toISOString().slice(0, 10)
    try {
      const { timeEntry: teApi } = await import('../services/api.js')
      return await teApi.listRange(token, fmt(from), fmt(to))
    } catch {
      return []
    }
  }

  // ─── Lấy entry mới nhất của task ──────────────────────────────────────────

  function getLatestEntry(taskId) {
    const taskEntries = entries
      .filter(e => e.task_id === taskId)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
    return taskEntries[0] || null
  }

  // ─── Sort tasks ────────────────────────────────────────────────────────────

  const sortedTasks = [...tasks].sort((a, b) => {
    let va, vb
    const ea = getLatestEntry(a.id)
    const eb = getLatestEntry(b.id)

    switch (sortBy) {
      case 'title':
        va = a.title.toLowerCase(); vb = b.title.toLowerCase()
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      case 'priority':
        va = a.priority ?? 1; vb = b.priority ?? 1
        break
      case 'start_time':
        va = ea ? new Date(ea.start_time) : new Date(0)
        vb = eb ? new Date(eb.start_time) : new Date(0)
        break
      case 'end_time':
        va = ea?.end_time ? new Date(ea.end_time) : new Date(0)
        vb = eb?.end_time ? new Date(eb.end_time) : new Date(0)
        break
      default: // created_at
        va = new Date(a.created_at || 0)
        vb = new Date(b.created_at || 0)
    }
    return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
  })

  // ─── Click outside sort menu ──────────────────────────────────────────────

  useEffect(() => {
    function handler(e) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setShowSortMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ─── Form handlers ────────────────────────────────────────────────────────

  function openAdd() {
    setEditTask(null)
    setTitle(''); setDescription(''); setPriority(1)
    setShowForm(true)
  }

  function openEdit(t) {
    setEditTask(t)
    setTitle(t.title)
    setDescription(t.description || '')
    setPriority(t.priority || 1)
    setShowForm(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!title.trim()) return
    const pInfo = getPriorityInfo(priority)
    const body = { title: title.trim(), description: description.trim(), priority, color: pInfo.hex }
    if (editTask) {
      await taskApi.update(token, editTask.id, body)
    } else {
      await taskApi.create(token, body)
    }
    setShowForm(false)
    loadAll()
  }

  async function handleDelete(id) {
    if (!confirm('Xác nhận xóa công việc này?')) return
    await taskApi.delete(token, id)
    loadAll()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <h2>Công việc</h2>
        <div className={styles.headerActions}>
          {/* Nút sort — hình tam giác */}
          <div className={styles.sortWrapper} ref={sortMenuRef}>
            <button
              className={styles.sortTrigger}
              onClick={() => setShowSortMenu(v => !v)}
              title="Sắp xếp"
            >
              ▼ Sắp xếp
            </button>
            {showSortMenu && (
              <div className={styles.sortMenu}>
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    className={`${styles.sortMenuItem} ${sortBy === opt.key ? styles.sortMenuActive : ''}`}
                    onClick={() => {
                      if (sortBy === opt.key) {
                        setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortBy(opt.key)
                        setSortDir('asc')
                      }
                      setShowSortMenu(false)
                    }}
                  >
                    <span>{opt.label}</span>
                    {sortBy === opt.key && (
                      <span className={styles.sortArrow}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className={styles.addBtn} onClick={openAdd}>+ Thêm</button>
        </div>
      </div>

      {/* Form thêm / sửa */}
      {showForm && (
        <form className={styles.form} onSubmit={handleSave}>
          <div className={styles.field}>
            <label>Tên công việc</label>
            <input type="text" value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Vd: Ôn tập React" required autoFocus />
          </div>
          <div className={styles.field}>
            <label>Mô tả</label>
            <textarea value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Mô tả ngắn (tuỳ chọn)" rows={2} />
          </div>

          {/* Mức ưu tiên */}
          <div className={styles.field}>
            <label>Mức độ ưu tiên</label>
            <div className={styles.priorityBar}>
              <div className={styles.priorityTrack} />
              <div className={styles.priorityDots}>
                {PRIORITY_LEVELS.map(p => (
                  <button key={p.value} type="button"
                    className={`${styles.priorityDot} ${priority === p.value ? styles.prioritySelected : ''}`}
                    style={{ '--dot-color': p.hex }}
                    onClick={() => setPriority(p.value)}
                    title={p.label}
                  />
                ))}
              </div>
              <div className={styles.priorityEndLabels}>
                <span>Không vội</span>
                <span>Cấp thiết</span>
              </div>
            </div>
            <p className={styles.priorityCurrent} style={{ color: getPriorityInfo(priority).hex }}>
              {getPriorityInfo(priority).label}
            </p>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.saveBtn}>Lưu</button>
            <button type="button" className={styles.cancelBtn}
              onClick={() => setShowForm(false)}>Huỷ</button>
          </div>
        </form>
      )}

      {/* Danh sách tasks */}
      {sortedTasks.length === 0 && !showForm && (
        <p className={styles.empty}>Chưa có công việc nào. Nhấn "+ Thêm" để bắt đầu.</p>
      )}

      <ul className={styles.taskList}>
        {sortedTasks.map(t => {
          const pInfo     = getPriorityInfo(t.priority)
          const latestEntry = getLatestEntry(t.id)
          const status    = getTaskStatus(t, latestEntry)
          const statusCls = getStatusClass(t, latestEntry)

          return (
            <li key={t.id} className={styles.taskCard}>
              {/* Hàng trên: chấm ưu tiên + tên + badge trạng thái + nút */}
              <div className={styles.taskTop}>
                <span className={styles.dot} style={{ background: pInfo.hex }} title={pInfo.label} />
                <span className={styles.taskTitle}>{t.title}</span>
                <span className={`${styles.statusBadge} ${styles[`status_${statusCls}`]}`}>
                  {status}
                </span>
                <div className={styles.taskActions}>
                  <button className={styles.editBtn} onClick={() => openEdit(t)}>Sửa</button>
                  <button className={styles.deleteBtn} onClick={() => handleDelete(t.id)}>Xóa</button>
                </div>
              </div>

              {/* Mô tả */}
              {t.description && (
                <p className={styles.taskDesc}>{t.description}</p>
              )}

              {/* Hàng dưới: thời gian + thời lượng */}
              <div className={styles.taskMeta}>
                <span className={styles.metaItem}>
                  <span className={styles.metaLabel}>Bắt đầu:</span>
                  {latestEntry?.start_time?.slice(11, 16) || '—'}
                </span>
                <span className={styles.metaItem}>
                  <span className={styles.metaLabel}>Kết thúc:</span>
                  {latestEntry?.end_time?.slice(11, 16) || '—'}
                </span>
                <span className={styles.metaItem}>
                  <span className={styles.metaLabel}>Thời lượng:</span>
                  {latestEntry?.duration ? formatDuration(latestEntry.duration) : '—'}
                </span>
                <span className={styles.metaItem}>
                  <span className={styles.metaLabel}>Ưu tiên:</span>
                  <span style={{ color: pInfo.hex, fontWeight: 600 }}>{pInfo.label}</span>
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
