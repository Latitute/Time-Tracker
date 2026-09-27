import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      localStorage.setItem('token', 'mock-token-for-dev');
      navigate('/dashboard');
      window.location.reload(); 
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#d3d3d3' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '20px', width: '350px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h1 style={{ color: '#00008B', marginBottom: '30px' }}>Time Tracker</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <input 
            type="email" 
            placeholder="Email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '15px', borderRadius: '50px', border: 'none', backgroundColor: '#e0e0e0', fontSize: '16px' }}
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '15px', borderRadius: '50px', border: 'none', backgroundColor: '#e0e0e0', fontSize: '16px' }}
          />
          <button type="submit" style={{ padding: '15px', borderRadius: '50px', border: 'none', backgroundColor: '#a9a9a9', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
            Sign In
          </button>
        </form>
        <p style={{ marginTop: '20px' }}>
          Don't have an account? <Link to="/signup" style={{ color: '#00008B' }}>Sign Up</Link>
        </p>
      </div>
    </div>
  );
}