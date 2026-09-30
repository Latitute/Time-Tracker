import { useState, useRef, useCallback, useEffect } from 'react'

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
  if (Number.isNaN(ms)) throw new Error(`Invalid timer start_time: "${startTime}"`)
  return ms
}

export function useTimer() {
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [elapsedSeconds,   setElapsedSeconds]   = useState(0)
  const [isRunning,        setIsRunning]         = useState(false)
  const [isExpired,        setIsExpired]         = useState(false)
  const intervalRef       = useRef(null)
  const startMsRef        = useRef(null)
  const targetSecondsRef  = useRef(0)
  const modeRef           = useRef('down')

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

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

  const startUp = useCallback((serverStartTime = null) => {
    if (intervalRef.current) return
    modeRef.current    = 'up'
    startMsRef.current = serverStartTime
      ? parseStartMs(serverStartTime)
      : Date.now()

    setIsExpired(false)
    setIsRunning(true)

    const calc = () => Math.floor((Date.now() - startMsRef.current) / 1000)
    setElapsedSeconds(calc())

    intervalRef.current = setInterval(() => {
      setElapsedSeconds(calc())
    }, 1000)
  }, [clearTimer])

  const stop = useCallback(() => {
    clearTimer()
    setIsRunning(false)
  }, [clearTimer])

  const reset = useCallback(() => {
    clearTimer()
    setIsRunning(false)
    setIsExpired(false)
    setRemainingSeconds(0)
    setElapsedSeconds(0)
    startMsRef.current       = null
    targetSecondsRef.current = 0
  }, [clearTimer])

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
