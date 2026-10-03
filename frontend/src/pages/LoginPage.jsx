
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')         
  const [password, setPassword] = useState('')   
  const [error, setError] = useState('')         
  const [loading, setLoading] = useState(false)  

  const { login } = useAuth()
  const navigate = useNavigate()


  const handleSubmit = async (e) => {
    e.preventDefault()  
    setError('')        
    setLoading(true)    
    try {
      await login(email, password) 
      navigate('/')                 
    } catch (err) {
      setError(err.message || 'Fail login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Time Tracker</h1>
        <p className={styles.subtitle}>Login to start</p>

        {/* onSubmit: khi người dùng nhấn Enter hoặc nút submit */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Email</label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}  
              placeholder="email@example.com" required
            />
          </div>
          <div className={styles.field}>
            <label>Password</label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu" required
            />
          </div>

          {/* Hiện lỗi chỉ khi có lỗi */}
          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Login...' : 'Login'}
          </button>
        </form>

        {/* Link chuyển sang trang đăng ký */}
        <p className={styles.switch}>
          Don't have account yet?  <Link to="/signup">Register</Link>
        </p>
      </div>
    </div>
  )
}
