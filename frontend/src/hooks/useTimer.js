/**
 * useTimer.js — Hỗ trợ hai chế độ:
 *
 *  - start(targetDuration, startTime) → Countdown (đếm ngược)
 *    Dùng khi timer có target_duration > 0.
 *    Khi remainingSeconds về 0, isExpired = true.
 *
 *  - startUp(serverStartTime)         → Stopwatch (đếm xuôi)
 *    Dùng khi timer không có target_duration (stopwatch mode).
 *    Không bao giờ expire.
 *
 * Cả hai chế độ đều tính thời gian từ timestamp thực (Date.now)
 * thay vì decrement để tránh drift khi tab bị background.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Parse start_time từ MySQL sang milliseconds.
 *
 * MySQL trả "2026-09-29 15:00:00" (không có Z) — thêm Z để ép parse UTC.
 * Nếu chuỗi không parse được → throw (KHÔNG fallback về Date.now()).
 * Fallback ngầm sẽ làm timer tưởng vừa bắt đầu và che giấu data corruption.
 *
 * @throws {Error} Nếu startTime không thể parse thành timestamp hợp lệ
 */
function parseStartMs(startTime) {
  if (startTime instanceof Date) {
    if (Number.isNaN(startTime.getTime())) throw new Error('Invalid timer start_time: Date object is invalid')
    return startTime.getTime()
  }
  if (typeof startTime === 'number') {
    if (Number.isNaN(startTime)) throw new Error('Invalid timer start_time: NaN')
    return startTime
  }
  const iso = String(startTime).replace(' ', 'T').replace(/Z?$/, 'Z')
  const ms = Date.parse(iso)
  // #17: Không fallback — throw để caller quyết định cách xử lý lỗi
  if (Number.isNaN(ms)) throw new Error(`Invalid timer start_time: "${startTime}"`)
  return ms
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
  // throws nếu startTime không hợp lệ
  const start = useCallback((targetDuration, startTime) => {
    if (intervalRef.current) return
    modeRef.current          = 'down'
    targetSecondsRef.current = targetDuration
    startMsRef.current       = parseStartMs(startTime) // throws on invalid

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
  // serverStartTime: start_time từ server (string hoặc Date).
  // throws nếu serverStartTime không hợp lệ (= data corruption từ server)
  const startUp = useCallback((serverStartTime = null) => {
    if (intervalRef.current) return
    modeRef.current    = 'up'
    // Dùng server timestamp để tránh sai lệch đồng hồ client/server.
    // null → fallback về Date.now() (khi tạo mới, không phải restore)
    startMsRef.current = serverStartTime
      ? parseStartMs(serverStartTime) // throws on invalid
      : Date.now()

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
