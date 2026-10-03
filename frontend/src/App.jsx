import { BrowserRouter, Routes, Route, Navigate, Outlet, NavLink, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import TimerPage from './pages/TimerPage.jsx'
import TasksPage from './pages/TasksPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import CalendarPage from './pages/CalendarPage.jsx'

function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <AppLayout />
}

function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/login') }
  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      <nav style={{ width: 240, background: '#fff', borderRight: '1px solid #DEE2E6', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ color: '#4361EE', marginBottom: '1.5rem', fontSize: '1.125rem', fontWeight: 700 }}>Time Tracker</h2>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavItem to="/">Timer</NavItem>
          <NavItem to="/tasks">Tasks</NavItem>
          <NavItem to="/dashboard">Dashboard</NavItem>
          <NavItem to="/calendar">Calender</NavItem>
        </div>
        <div style={{ borderTop: '1px solid #DEE2E6', paddingTop: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#6C757D' }}>{user?.name}</span>
          <button onClick={handleLogout} style={{ display: 'block', marginTop: '0.5rem', background: 'none', border: 'none', color: '#EF476F', cursor: 'pointer', fontSize: '0.875rem', padding: 0 }}>Log out</button>
        </div>
      </nav>
      <main style={{ flex: 1, padding: '2rem', background: '#F8F9FA' }}><Outlet /></main>
    </div>
  )
}

function NavItem({ to, children }) {
  return <NavLink to={to} style={({ isActive }) => ({ display: 'block', padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.875rem', textDecoration: 'none', background: isActive ? 'rgba(67, 97, 238, 0.1)' : 'transparent', color: isActive ? '#4361EE' : '#6C757D', fontWeight: isActive ? 600 : 400 })}>{children}</NavLink>
}

export default function App() {
  return (
    <BrowserRouter><AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<ProtectedRoute />}>
          <Route index element={<TimerPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="calendar" element={<CalendarPage />} />
        </Route>
      </Routes>
    </AuthProvider></BrowserRouter>
  )
}
