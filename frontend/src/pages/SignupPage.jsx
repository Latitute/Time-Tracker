import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import styles from './SignupPage.module.css'

export default function SignupPage() {
  const [name, setName] = useState('')               
  const [email, setEmail] = useState('')             
  const [password, setPassword] = useState('')       
  const [confirmPassword, setConfirmPassword] = useState('') 
  const [error, setError] = useState('')             
  const [loading, setLoading] = useState(false)     

  const { register } = useAuth()
  const navigate = useNavigate()

  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      return setError('Incorrect password')
    }

    if (password.length < 6) {
      return setError('Password must have atleast 6 characters')
    }

    setLoading(true)
    try {
      await register(name, email, password)
      navigate('/') 
    } catch (err) {
      setError(err.message || 'Fail')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Register</h1>
        <p className={styles.subtitle}>Register to use Time Tracker</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Name" required />
          </div>
          <div className={styles.field}>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com" required />
          </div>
          <div className={styles.field}>
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Atleast 6 character" required />
          </div>
          <div className={styles.field}>
            <label>Enter password again</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Password" required />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Register...' : 'Register'}
          </button>
        </form>

        <p className={styles.switch}>
          Already have account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  )
}
