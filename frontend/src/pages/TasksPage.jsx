import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { task as taskApi, timeEntry as teApi } from '../services/api.js'
import { formatDuration, formatLocalTime, localDateRange } from '../utils/format-time.js'
import styles from './TasksPage.module.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { key: 'title',      label: 'Tên'                },
  { key: 'created_at', label: 'Thời gian tạo'      },
  { key: 'start_time', label: 'Thời gian bắt đầu' },
  { key: 'end_time',   label: 'Thời gian kết thúc'},
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTaskStatus(latestEntry) {
  if (!latestEntry) return 'Chưa bắt đầu'
  if (!latestEntry.end_time) return 'Đang thực hiện'
  return 'Đã kết thúc'
}

function getStatusClass(latestEntry) {
  // #24: dùng 'not_started' thay vì 'upcoming' để khớp với tên thực tế của trạng thái
  if (!latestEntry) return 'not_started'
  if (!latestEntry.end_time) return 'running'
  return 'done'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { token } = useAuth()

  const [tasks, setTasks]         = useState([])
  const [entries, setEntries]     = useState([])
  const [showForm, setShowForm]   = useState(false)
  const [editTask, setEditTask]   = useState(null)

  // Form feedback
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)  // task id đang xóa
  const [formError, setFormError] = useState(null)

  // Form fields
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')

  // Sort
  const [sortBy, setSortBy]             = useState('created_at')
  const [sortDir, setSortDir]           = useState('asc')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortMenuRef = useRef(null)

  // ─── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => { loadAll() }, [token])

  async function loadAll() {
    try {
      const [taskList, entryList] = await Promise.all([
        taskApi.list(token),
        fetchRecentEntries(),
      ])
      setTasks(taskList)
      setEntries(entryList)
    } catch (err) {
      console.error('[TasksPage loadAll]', err)
    }
  }

  async function fetchRecentEntries() {
    const { from, to } = localDateRange(30)
    try {
      return await teApi.listRange(token, from, to)
    } catch {
      return []
    }
  }

  // ─── Lấy entry mới nhất của từng task — O(n) với Map ─────────────────────
  // #23: useMemo + Map thay vì gọi filter().sort() N lần trong render

  const latestEntryByTask = useMemo(() => {
    const map = new Map()
    for (const entry of entries) {
      const current = map.get(entry.task_id)
      // So sánh bằng chuỗi — start_time là UTC ISO nên sort lexicographically đúng
      if (!current || entry.start_time > current.start_time) {
        map.set(entry.task_id, entry)
      }
    }
    return map
  }, [entries])

  // ─── Sort tasks ────────────────────────────────────────────────────────────

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const ea = latestEntryByTask.get(a.id)
      const eb = latestEntryByTask.get(b.id)
      let va, vb

      switch (sortBy) {
        case 'title':
          va = a.title.toLowerCase(); vb = b.title.toLowerCase()
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
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
      // #24 (sort): return 0 khi bằng nhau để sort stable
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [tasks, sortBy, sortDir, latestEntryByTask])

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
    setTitle(''); setDescription('')
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(t) {
    setEditTask(t)
    setTitle(t.title)
    setDescription(t.description || '')
    setFormError(null)
    setShowForm(true)
  }

  // #26: handleSave với loading state và error handling
  async function handleSave(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setFormError(null)
    const body = { title: title.trim(), description: description.trim() }
    try {
      if (editTask) {
        await taskApi.update(token, editTask.id, body)
      } else {
        await taskApi.create(token, body)
      }
      setShowForm(false)
      await loadAll()
    } catch (err) {
      setFormError(err.message || 'Lỗi không xác định. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  // #26: handleDelete với loading state và error handling
  async function handleDelete(id) {
    if (!confirm('Xác nhận xóa công việc này?')) return
    setDeleting(id)
    try {
      await taskApi.delete(token, id)
      await loadAll()
    } catch (err) {
      // Hiển thị lỗi inline — 409 = timer đang chạy, nên thông báo rõ
      alert(err.message || 'Không thể xóa công việc. Vui lòng thử lại.')
    } finally {
      setDeleting(null)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <h2>Công việc</h2>
        <div className={styles.headerActions}>
          {/* Nút sort */}
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

          {/* #26: Hiển thị lỗi từ server */}
          {formError && (
            <p className={styles.formError}>{formError}</p>
          )}

          <div className={styles.formActions}>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
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
          const latestEntry = latestEntryByTask.get(t.id) || null
          const status      = getTaskStatus(latestEntry)
          const statusCls   = getStatusClass(latestEntry)
          const isBeingDeleted = deleting === t.id

          return (
            <li key={t.id} className={styles.taskCard}>
              {/* Hàng trên: chấm màu + tên + badge trạng thái + nút */}
              <div className={styles.taskTop}>
                <span
                  className={styles.dot}
                  style={{ background: t.color || '#4361EE' }}
                />
                <span className={styles.taskTitle}>{t.title}</span>
                {/* #24: class 'not_started' thay vì 'upcoming' */}
                <span className={`${styles.statusBadge} ${styles[`status_${statusCls}`]}`}>
                  {status}
                </span>
                <div className={styles.taskActions}>
                  <button className={styles.editBtn} onClick={() => openEdit(t)}>Sửa</button>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(t.id)}
                    disabled={isBeingDeleted}
                  >
                    {isBeingDeleted ? '...' : 'Xóa'}
                  </button>
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
                  {formatLocalTime(latestEntry?.start_time) || '—'}
                </span>
                <span className={styles.metaItem}>
                  <span className={styles.metaLabel}>Kết thúc:</span>
                  {formatLocalTime(latestEntry?.end_time) || '—'}
                </span>
                <span className={styles.metaItem}>
                  <span className={styles.metaLabel}>Thời lượng:</span>
                  {/* duration=0 hiện "0s" thay vì '—' */}
                  {latestEntry?.duration != null ? formatDuration(latestEntry.duration) : '—'}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
