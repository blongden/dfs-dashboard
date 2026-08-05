import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchCurrentRequirements } from '../api/requirements'

const POLL_INTERVAL_MS = 60_000

export function useEventAlerts(): {
  newEventIds: number[]
  lastChecked: Date | null
  dismiss: () => void
} {
  const queryClient = useQueryClient()
  const knownEventIds = useRef<Set<number> | null>(null)
  const [newEventIds, setNewEventIds] = useState<number[]>([])
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const dismiss = useCallback(() => setNewEventIds([]), [])

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const reqs = await fetchCurrentRequirements()
        if (cancelled) return

        const ids = new Set(reqs.map((r) => Number(r['Event ID'])).filter(Boolean))

        if (knownEventIds.current === null) {
          knownEventIds.current = ids
          setLastChecked(new Date())
          return
        }

        const newIds = [...ids].filter((id) => !knownEventIds.current!.has(id))
        if (newIds.length > 0) {
          knownEventIds.current = ids
          setNewEventIds(newIds)
          queryClient.invalidateQueries({ queryKey: ['current'] })
          queryClient.invalidateQueries({ queryKey: ['currentReqs'] })
        }

        setLastChecked(new Date())
      } catch {
        // Silently ignore poll failures
      }
    }

    check()
    const timer = setInterval(check, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [queryClient])

  return { newEventIds, lastChecked, dismiss }
}
