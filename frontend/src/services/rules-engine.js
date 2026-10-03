const rules = [
  {
    id: 'overtime-daily',
    priority: 0,
    check: (stats) => {
      const today = stats.byDay?.find(d => d.date === new Date().toISOString().slice(0, 10))
      return today && today.totalSeconds > 28800
    },
    message: 'You have worked over 8 hours today. You should take a rest!',
    type: 'warning'
  },
  {
    id: 'break-reminder',
    priority: 0,
    check: (stats) => {
      if (!stats.activeEntry) return false
      const elapsed = Math.floor((Date.now() - new Date(stats.activeEntry.start_time).getTime()) / 1000)
      return elapsed > 5400
    },
    message: 'You have been working continuously for over 90 minutes. Take a 5-minute break!',
    type: 'warning'
  },
  {
    id: 'weekly-overtime',
    priority: 1,
    check: (stats) => stats.totalSeconds > 144000,
    message: 'You have worked over 40 hours this week. Keep it balanced!',
    type: 'info'
  },
  {
    id: 'streak',
    priority: 1,
    check: (stats) => {
      const streak = computeStreak(stats.byDay || [])
      return streak >= 3
    },
    message: '',
    type: 'success',
    dynamicMessage: (stats) => `${computeStreak(stats.byDay || [])} consecutive logged days! Awesome!`
  },
  {
    id: 'low-productivity',
    priority: 2,
    check: (stats) => {
      const today = stats.byDay?.find(d => d.date === new Date().toISOString().slice(0, 10))
      const hour = new Date().getHours()
      return hour >= 18 && today && today.totalSeconds < 7200
    },
    message: 'You have worked less than 2 hours today. Keep it up!',
    type: 'info'
  },
  {
    id: 'category-imbalance',
    priority: 2,
    check: (stats) => {
      if (!stats.byTask || stats.byTask.length < 2 || stats.totalSeconds === 0) return false
      const maxTask = Math.max(...stats.byTask.map(t => t.totalSeconds))
      return maxTask / stats.totalSeconds > 0.7
    },
    message: '',
    type: 'info',
    dynamicMessage: (stats) => {
      const max = stats.byTask.reduce((a, b) => a.totalSeconds > b.totalSeconds ? a : b)
      return `The task "${max.title}" accounts for more than 70% of your time this week. Consider reallocating?`
    }
  }
]

function computeStreak(byDay) {
  let streak = 0
  const sorted = [...byDay].sort((a, b) => b.date.localeCompare(a.date))
  for (const day of sorted) {
    if (day.totalSeconds > 0) streak++
    else break
  }
  return streak
}

export function evaluateRules(stats) {
  const results = []
  for (const rule of rules) {
    try {
      if (rule.check(stats)) {
        results.push({
          id: rule.id,
          priority: rule.priority,
          message: rule.dynamicMessage ? rule.dynamicMessage(stats) : rule.message,
          type: rule.type
        })
      }
    } catch {}
  }
  return results.sort((a, b) => a.priority - b.priority)
}