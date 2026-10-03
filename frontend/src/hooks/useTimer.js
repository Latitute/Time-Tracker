

import { useState, useRef, useCallback, useEffect } from 'react'

export function useTimer() {
  const [seconds, setSeconds] = useState(0)       
  const [isRunning, setIsRunning] = useState(false) 

  const intervalRef = useRef(null)     
  const startTimeRef = useRef(null)    

  const start = useCallback((existingElapsed = 0) => {
    if (intervalRef.current) return

    startTimeRef.current = Date.now() - existingElapsed * 1000
    setIsRunning(true)
    setSeconds(existingElapsed)

    intervalRef.current = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
  }, [])


  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current) 
      intervalRef.current = null
    }
    setIsRunning(false)
  }, [])


  const reset = useCallback(() => {
    stop()
    setSeconds(0)
    startTimeRef.current = null
  }, [stop])

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  return { seconds, isRunning, start, stop, reset }
}
