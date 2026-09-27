import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CalendarPage from './pages/Calendar/CalendarPage.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CalendarPage />} />
      </Routes>
    </Router>
  );
}

export default App;