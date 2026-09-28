
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { task as taskApi } from '../services/api.js'
import styles from './TasksPage.module.css'

const COLORS = ['#4361EE', '#06D6A0', '#EF476F', '#FFD166', '#118AB2', '#073B4C', '#8338EC', '#FB5607']

export default function TasksPage() {
  const { token } = useAuth()
  const [tasks, setTasks] = useState([])        
  const [showForm, setShowForm] = useState(false) 
  const [editTask, setEditTask] = useState(null)  

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLORS[0])

  useEffect(() => { loadTasks() }, [token])

  async function loadTasks() {
    const list = await taskApi.list(token)
    setTasks(list)
  }

  function openAdd() {
    setEditTask(null)          
    setTitle('')
    setDescription('')
    setColor(COLORS[0])
    setShowForm(true)
  }

  function openEdit(t) {
    setEditTask(t)             
    setTitle(t.title)
    setDescription(t.description || '')
    setColor(t.color)
    setShowForm(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!title.trim()) return
    if (editTask) {
      await taskApi.update(token, editTask.id, { title, description, color })
    } else {
      await taskApi.create(token, { title, description, color })
    }
    setShowForm(false)
    loadTasks() 
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure to delete?')) return
    await taskApi.delete(token, id)
    loadTasks()
  }

  return (
    <div className={styles.page}>
      {/* Tiêu đề + nút tạo mới */}
      <div className={styles.header}>
        <h2>Work</h2>
        <button className={styles.addBtn} onClick={openAdd}>+ Add</button>
      </div>

      {/* Form thêm/sửa công việc */}
      {showForm && (
        <form className={styles.form} onSubmit={handleSave}>
          <div className={styles.field}>
            <label>Name</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Learn React" required />
          </div>
          <div className={styles.field}>
            <label>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Description" rows={2} />
          </div>
          <div className={styles.field}>
            <label>Color</label>
            <div className={styles.colorPicker}>
              {COLORS.map(c => (
                <button key={c} type="button"
                  className={`${styles.colorDot} ${c === color ? styles.selected : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.saveBtn}>Save</button>
            <button type="button" className={styles.cancelBtn}
              onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Danh sách công việc */}
      <ul className={styles.taskList}>
        {tasks.map(t => (
          <li key={t.id} className={styles.taskCard}>
            {/* Chấm tròn màu công việc */}
            <span className={styles.dot} style={{ background: t.color }} />
            {/* Thông tin công việc */}
            <div className={styles.taskInfo}>
              <span className={styles.taskTitle}>{t.title}</span>
              {t.description && <span className={styles.taskDesc}>{t.description}</span>}
            </div>
            {/* Nút hành động */}
            <div className={styles.taskActions}>
              <button onClick={() => openEdit(t)} className={styles.editBtn}>Sửa</button>
              <button onClick={() => handleDelete(t.id)} className={styles.deleteBtn}>Xóa</button>
            </div>
          </li>
        ))}
        {tasks.length === 0 && <p className={styles.empty}>There are no jobs yet. Click "Add New" to begin.</p>}
      </ul>
    </div>
  )
}
