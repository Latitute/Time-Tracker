import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { timeEntry } from '../services/api.js'
import { formatDuration } from '../utils/format-time.js'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,        // Biểu đồ cột
  ResponsiveContainer, PieChart, Pie, Cell,      // Biểu đồ tròn
} from 'recharts'
import styles from './DashboardPage.module.css'

const COLORS = ['#4361EE', '#06D6A0', '#EF476F', '#FFD166', '#118AB2', '#073B4C', '#8338EC', '#FB5607']

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function computeStreak(byDay) {
  if (!byDay || byDay.length === 0) return 0
  const sorted = [...byDay].sort((a, b) => b.date.localeCompare(a.date))
  let streak = 0
  for (const day of sorted) {
    if (day.totalSeconds > 0) streak++
    else break
  }
  return streak
}

function barTooltipFmt(v) { return [`${v}h`, 'Time'] }
function pieTooltipFmt(v) { return [`${v}h`, 'Time'] }

export default function DashboardPage() {
  const { token } = useAuth()
  const [stats, setStats] = useState(null)    
  const [error, setError] = useState(null)    

  useEffect(() => {
    if (!token) return
    timeEntry.stats(token, 'week')
      .then(setStats)
      .catch(err => setError(err.message || 'Failed loading'))
  }, [token])

  return (
    <div className={styles.page}>
      <h2 className={styles.pageTitle}>Dashboard</h2>

      {error && <p className={styles.empty}>{error}</p>}
      {!stats && !error && <p className={styles.loading}>Loading</p>}
      {stats && <StatsContent stats={stats} />}
    </div>
  )
}

function StatsContent({ stats }) {
  const todayStr = new Date().toISOString().slice(0, 10)  
  const todayEntry = (stats.byDay || []).find(d => d.date === todayStr)
  const todaySeconds = todayEntry ? todayEntry.totalSeconds : 0  
  const weekSeconds = stats.totalSeconds || 0                      
  const dayCount = (stats.byDay || []).length || 1                 
  const avgSeconds = Math.round(weekSeconds / dayCount)            
  const streak = computeStreak(stats.byDay)                        

  const barData = (stats.byDay || []).map(d => ({
    day: DAY_LABELS[new Date(d.date).getDay()],  
    hours: Math.round((d.totalSeconds / 3600) * 100) / 100,  
  }))

  const pieData = (stats.byTask || []).map(t => ({
    name: t.taskName || t.task_name || 'Other',
    value: Math.round((t.totalSeconds / 3600) * 100) / 100,
  }))

  const kpis = [
    { label: 'Today', value: formatDuration(todaySeconds) },
    { label: 'This week', value: formatDuration(weekSeconds) },
    { label: 'Daily Average', value: formatDuration(avgSeconds) },
    { label: 'Streak', value: `${streak} day` },
  ]

  return (
    <>
      {/* Hàng 4 ô KPI */}
      <div className={styles.kpiGrid}>
        {kpis.map(kpi => (
          <div key={kpi.label} className={styles.kpiCard}>
            <div className={styles.kpiLabel}>{kpi.label}</div>
            <div className={styles.kpiValue}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Hai biểu đồ: cột (trái) + tròn (phải) */}
      <div className={styles.chartsGrid}>
        {/* Biểu đồ cột - giờ theo ngày */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Hours by day</h3>
          {barData.length > 0 ? (
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={barTooltipFmt} />
                  <Bar dataKey="hours" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className={styles.empty}>No data available</p>
          )}
        </div>

        {/* Biểu đồ tròn - giờ theo công việc */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Hours by Task</h3>
          {pieData.length > 0 ? (
            <>
              <div className={styles.pieContainer}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData} cx="50%" cy="50%"
                      innerRadius={50} outerRadius={90}  // Donut chart (tròn rỗng giữa)
                      paddingAngle={2} dataKey="value"
                    >
                      {/* Màu khác nhau cho mỗi đoạn */}
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={pieTooltipFmt} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Chú thích (legend) */}
              <ul className={styles.legend}>
                {pieData.map((item, i) => (
                  <li key={item.name} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: COLORS[i % COLORS.length] }} />
                    {item.name} ({item.value}h)
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.empty}>No data available</p>
          )}
        </div>
      </div>
    </>
  )
}
