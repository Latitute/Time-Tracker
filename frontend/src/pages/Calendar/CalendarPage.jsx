import { useState, useEffect } from 'react';
import { format, addMonths } from 'date-fns';
import { getCalendarGrid, groupSchedulesByDate } from '../../utils/calendar-utils.js';
import DayCell from './DayCell.jsx';
import DayDetailModal from './DayDetailModal.jsx';
import styles from './CalendarPage.module.css';

const USE_MOCK = true;

const MOCK_SCHEDULES = [
  { id: 1, task_title: 'Lập kế hoạch dự án', task_color: '#4361EE', scheduled_date: '2026-09-27', start_time: '09:00', estimated_duration: 3600, completed: false },
  { id: 2, task_title: 'Học React', task_color: '#F72585', scheduled_date: '2026-09-27', start_time: '14:00', estimated_duration: 7200, completed: false },
  { id: 3, task_title: 'Viết báo cáo', task_color: '#4CC9F0', scheduled_date: '2026-09-28', start_time: '10:30', estimated_duration: 1800, completed: true },
  { id: 4, task_title: 'Review code', task_color: '#7209B7', scheduled_date: '2026-09-30', start_time: '15:00', estimated_duration: 3600, completed: false },
];

const MOCK_TASKS = [
  { id: 1, title: 'Lập kế hoạch dự án', color: '#4361EE' },
  { id: 2, title: 'Học React', color: '#F72585' },
  { id: 3, title: 'Viết báo cáo', color: '#4CC9F0' },
  { id: 4, title: 'Review code', color: '#7209B7' },
];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [grid, setGrid] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    setGrid(getCalendarGrid(currentDate));
  }, [currentDate]);

  useEffect(() => {
    if (USE_MOCK) {
      setSchedules(MOCK_SCHEDULES);
      setTasks(MOCK_TASKS);
    }
  }, [currentDate]);

  const grouped = groupSchedulesByDate(schedules);

  const handleCreate = (data) => {
    const newItem = {
      id: Date.now(),
      ...data,
      task_title: tasks.find(t => t.id === parseInt(data.task_id))?.title || 'Task',
      task_color: tasks.find(t => t.id === parseInt(data.task_id))?.color || '#ccc',
      completed: false
    };
    setSchedules(prev => [...prev, newItem]);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>Lịch công việc</h2>
        <div className={styles.nav}>
          <button onClick={() => setCurrentDate(p => addMonths(p, -1))}>←</button>
          <span>{format(currentDate, 'MMMM yyyy')}</span>
          <button onClick={() => setCurrentDate(p => addMonths(p, 1))}>→</button>
          <button className={styles.todayBtn} onClick={() => setCurrentDate(new Date())}>Hôm nay</button>
        </div>
      </div>

      <div className={styles.grid}>
        {['CN','T2','T3','T4','T5','T6','T7'].map(d => (
          <div key={d} className={styles.weekday}>{d}</div>
        ))}
        {grid.map((day, i) => (
          <DayCell
            key={i}
            day={day}
            schedules={grouped[day.dateString] || []}
            onClick={() => setSelectedDate(day)}
          />
        ))}
      </div>

      {selectedDate && (
        <DayDetailModal
          day={selectedDate}
          schedules={grouped[selectedDate.dateString] || []}
          tasks={tasks}
          onClose={() => setSelectedDate(null)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}