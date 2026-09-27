import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from 'date-fns';

export function getCalendarGrid(currentDate) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd);

  const days = [];
  let day = gridStart;
  while (day <= gridEnd) {
    days.push({
      date: day,
      dateString: format(day, 'yyyy-MM-dd'),
      isCurrentMonth: isSameMonth(day, currentDate),
      isToday: isSameDay(day, new Date())
    });
    day = addDays(day, 1);
  }
  return days;
}

export function groupSchedulesByDate(schedules = []) {
  const grouped = {};
  schedules.forEach(s => {
    if (!grouped[s.scheduled_date]) grouped[s.scheduled_date] = [];
    grouped[s.scheduled_date].push(s);
  });
  return grouped;
}

export function formatTime(dateStr) {
  if (!dateStr) return '';
  return dateStr.slice(0, 5);
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} phút`;
}

export function getTimeOptions() {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return options;
}