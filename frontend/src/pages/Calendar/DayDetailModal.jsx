import { useState } from 'react';
import { format } from 'date-fns';
import { getTimeOptions } from '../../utils/calendar-utils.js';
import styles from './CalendarPage.module.css';

export default function DayDetailModal({ day, schedules = [], tasks = [], onClose, onCreate }) {
  const [taskId, setTaskId] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState('3600');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!taskId) return alert('Chọn công việc đi bạn!');
    onCreate({
      task_id: parseInt(taskId),
      scheduled_date: day.dateString,
      start_time: startTime,
      estimated_duration: parseInt(duration)
    });
    setTaskId('');
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3>{format(day.date, 'dd/MM/yyyy')}</h3>

        {schedules.length > 0 && (
          <div className={styles.scheduleList}>
            <h4>Lịch đã đặt:</h4>
            {schedules.map(s => (
              <div key={s.id} className={styles.scheduleCard} style={{ borderColor: s.task_color }}>
                {s.task_title} — {s.start_time}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <h4>+ Tạo lịch mới</h4>
          <div className={styles.formGroup}>
            <label>Công việc</label>
            <select value={taskId} onChange={e => setTaskId(e.target.value)}>
              <option value="">-- Chọn --</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Bắt đầu</label>
            <select value={startTime} onChange={e => setStartTime(e.target.value)}>
              {getTimeOptions().map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Thời lượng</label>
            <select value={duration} onChange={e => setDuration(e.target.value)}>
              <option value="1800">30 phút</option>
              <option value="3600">1 giờ</option>
              <option value="5400">1.5 giờ</option>
              <option value="7200">2 giờ</option>
            </select>
          </div>
          <div className={styles.btnRow}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Đóng</button>
            <button type="submit" className={styles.btnPrimary}>Lưu</button>
          </div>
        </form>
      </div>
    </div>
  );
}