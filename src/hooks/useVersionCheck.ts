import { useState, useEffect, useRef } from 'react'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION as string | undefined

export function useVersionCheck(): boolean {
  const [newVersionAvailable, setNewVersionAvailable] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Skip in dev (no version set) or once we've already flagged an update
    if (!CURRENT_VERSION) return

    async function check() {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const { version } = await res.json()
        if (version && version !== CURRENT_VERSION) {
          setNewVersionAvailable(true)
          if (timerRef.current) clearInterval(timerRef.current)
        }
      } catch {
        // Network error — ignore, try again next interval
      }
    }

    timerRef.current = setInterval(check, POLL_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return newVersionAvailable
}
