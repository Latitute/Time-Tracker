/**
 * useTimer.js — Hỗ trợ hai chế độ:
 *
 *  - start(targetDuration, startTime) → Countdown (đếm ngược)
 *    Dùng khi timer có target_duration > 0.
 *    Khi remainingSeconds về 0, isExpired = true.
 *
 *  - startUp(existingElapsed)         → Stopwatch (đếm xuôi)
 *    Dùng khi timer không có target_duration (stopwatch mode).
 *    Không bao giờ expire.
 *
 * Cả hai chế độ đều tính thời gian từ timestamp thực (Date.now)
 * thay vì decrement để tránh drift khi tab bị background.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Parse start_time từ MySQL an toàn với timezone.
 * MySQL trả "2026-09-29 15:00:00" (không Z) — thêm Z để ép parse UTC
 * nhất quán giữa backend (MySQL UTC) và frontend (browser local).
 */
function parseStartMs(startTime) {
  if (startTime instanceof Date) return startTime.getTime()
  if (typeof startTime === 'number') return startTime
  const iso = String(startTime).replace(' ', 'T').replace(/Z?$/, 'Z')
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? Date.now() : ms
}

export function useTimer() {
  const [remainingSeconds, setRemainingSeconds] = useState(0)  // countdown
  const [elapsedSeconds,   setElapsedSeconds]   = useState(0)  // stopwatch
  const [isRunning,        setIsRunning]         = useState(false)
  const [isExpired,        setIsExpired]         = useState(false)

  const intervalRef       = useRef(null)
  const startMsRef        = useRef(null)
  const targetSecondsRef  = useRef(0)
  const modeRef           = useRef('down') // 'down' | 'up'

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // ─── Countdown (đếm ngược) ───────────────────────────────────────────────
  // targetDuration: số giây từ target_duration DB
  // startTime:      start_time từ DB (string "YYYY-MM-DD HH:mm:ss" hoặc Date)
  const start = useCallback((targetDuration, startTime) => {
    if (intervalRef.current) return
    modeRef.current          = 'down'
    targetSecondsRef.current = targetDuration
    startMsRef.current       = parseStartMs(startTime)

    setIsExpired(false)
    setIsRunning(true)

    const calc = () => Math.max(
      0,
      targetSecondsRef.current - Math.floor((Date.now() - startMsRef.current) / 1000)
    )

    setRemainingSeconds(calc())

    intervalRef.current = setInterval(() => {
      const rem = calc()
      setRemainingSeconds(rem)
      if (rem <= 0) {
        clearTimer()
        setIsRunning(false)
        setIsExpired(true)
      }
    }, 1000)
  }, [clearTimer])

  // ─── Stopwatch (đếm xuôi) ────────────────────────────────────────────────
  // existingElapsed: số giây đã trôi qua tính từ start_time (dùng khi restore sau refresh)
  const startUp = useCallback((existingElapsed = 0) => {
    if (intervalRef.current) return
    modeRef.current    = 'up'
    startMsRef.current = Date.now() - existingElapsed * 1000

    setIsExpired(false)
    setIsRunning(true)

    const calc = () => Math.floor((Date.now() - startMsRef.current) / 1000)
    setElapsedSeconds(calc())

    intervalRef.current = setInterval(() => {
      setElapsedSeconds(calc())
    }, 1000)
  }, [clearTimer]) // eslint-disable-line

  // ─── Dừng thủ công (không set isExpired) ────────────────────────────────
  const stop = useCallback(() => {
    clearTimer()
    setIsRunning(false)
  }, [clearTimer])

  // ─── Reset toàn bộ ──────────────────────────────────────────────────────
  const reset = useCallback(() => {
    clearTimer()
    setIsRunning(false)
    setIsExpired(false)
    setRemainingSeconds(0)
    setElapsedSeconds(0)
    startMsRef.current       = null
    targetSecondsRef.current = 0
  }, [clearTimer])

  // Cleanup khi unmount
  useEffect(() => () => clearTimer(), [clearTimer])

  return {
    remainingSeconds,
    elapsedSeconds,
    isRunning,
    isExpired,
    start,
    startUp,
    stop,
    reset,
  }
}
