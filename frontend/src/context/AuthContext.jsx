import { createContext, useContext, useReducer, useEffect } from 'react'
import { auth as authApi } from '../services/api.js'

const AuthContext = createContext(null)

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return { user: action.user, token: action.token, loading: false }
    case 'LOGOUT':
      return { user: null, token: null, loading: false }
    case 'SET_LOADING':
      return { ...state, loading: action.loading }
    default:
      return state
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null, token: null, loading: true
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      dispatch({ type: 'SET_LOADING', loading: false })
      return
    }
    authApi.me(token)
      .then(data => dispatch({ type: 'LOGIN', user: data.user, token }))
      .catch(() => {
        localStorage.removeItem('token')
        dispatch({ type: 'LOGOUT' })
      })
  }, [])

  const login = async (email, password) => {
    const data = await authApi.login({ email, password })
    localStorage.setItem('token', data.token)
    dispatch({ type: 'LOGIN', user: data.user, token: data.token })
  }

  const register = async (name, email, password) => {
    const data = await authApi.register({ name, email, password })
    localStorage.setItem('token', data.token)
    dispatch({ type: 'LOGIN', user: data.user, token: data.token })
  }

  const logout = () => {
    localStorage.removeItem('token')
    dispatch({ type: 'LOGOUT' })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải được dùng bên trong AuthProvider')
  return ctx
}
