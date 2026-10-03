import {
  startOfMonth,   
  endOfMonth,     
  startOfWeek,    
  endOfWeek,      
  eachDayOfInterval, 
  isSameMonth,    
  format,         
  addDays,        
} from 'date-fns'

const MONTH_NAMES = [
  'January', 'Feburary', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
]

export function getCalendarDays(year, month) {
  const monthStart = startOfMonth(new Date(year, month))
  const monthEnd = endOfMonth(monthStart)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  while (days.length < 42) {
    days.push(addDays(days[days.length - 1], 1))
  }

  return days.map(date => ({
    date,
    isCurrentMonth: isSameMonth(date, monthStart),
  }))
}

export function getMonthName(month) {
  return MONTH_NAMES[month]
}

export function formatDate(date) {
  return format(date, 'yyyy-MM-dd')
}

export function groupByDate(items, dateExtractor) {
  const map = {}
  for (const item of items) {
    const key = dateExtractor(item)
    if (!map[key]) map[key] = []
    map[key].push(item)
  }
  return map
}