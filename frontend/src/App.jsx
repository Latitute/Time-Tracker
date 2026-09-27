import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';

// Security wrapper for Step 4, 5, 6 developers
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

// Placeholder Layout with Sidebar matching wireframes
const AppLayout = ({ children }) => (
  <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#d3d3d3' }}>
    <aside style={{ width: '250px', backgroundColor: 'white', padding: '20px' }}>
      <h2 style={{ color: '#00008B', margin: 0 }}>Time Tracker</h2>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' }}>
        <a href="/timer" style={{ textDecoration: 'none', color: '#333' }}>Timer</a>
        <a href="/tasks" style={{ textDecoration: 'none', color: '#333' }}>Tasks</a>
        <a href="/calendar" style={{ textDecoration: 'none', color: '#333' }}>Calendar</a>
        <a href="/dashboard" style={{ textDecoration: 'none', color: '#333' }}>Dashboard</a>
      </nav>
    </aside>
    <main style={{ flex: 1, padding: '40px' }}>{children}</main>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Protected Routes for teammates to plug their pages into */}
          <Route path="/" element={<ProtectedRoute><AppLayout><Navigate to="/dashboard" /></AppLayout></ProtectedRoute>} />
          <Route path="/timer" element={<ProtectedRoute><AppLayout><h2>Timer Page (Step 4)</h2></AppLayout></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><AppLayout><h2>Tasks Page (Step 4)</h2></AppLayout></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><AppLayout><h2>Dashboard Page (Step 5)</h2></AppLayout></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><AppLayout><h2>Calendar Page (Step 6)</h2></AppLayout></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;