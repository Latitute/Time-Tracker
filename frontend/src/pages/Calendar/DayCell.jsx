import styles from './CalendarPage.module.css';

export default function DayCell({ day, schedules = [], onClick }) {
  const display = schedules.slice(0, 3);
  const more = schedules.length - 3;

  return (
    <div
      className={`
        ${styles.dayCell}
        ${!day.isCurrentMonth ? styles.otherMonth : ''}
        ${day.isToday ? styles.today : ''}
      `}
      onClick={onClick}
    >
      <div className={styles.dateNum}>{day.date.getDate()}</div>
      {display.map(s => (
        <div
          key={s.id}
          className={styles.scheduleItem}
          style={{ borderLeftColor: s.task_color || '#999' }}
        >
          {s.task_title}
        </div>
      ))}
      {more > 0 && <div className={styles.more}>+{more} lịch</div>}
    </div>
  );
}