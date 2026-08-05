import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchCurrentRequirements } from '../api/requirements'
import { ckanSearch } from '../api/client'
import { CURRENT_ID } from '../api/utilisation'

const POLL_INTERVAL_MS = 60_000

export function useEventAlerts(): {
  newEventIds: number[]
  newBidsAlert: boolean
  lastChecked: Date | null
  dismiss: () => void
} {
  const queryClient = useQueryClient()

  const knownEventIds = useRef<Set<number> | null>(null)
  const lastUtilisationId = useRef<number | null>(null)

  const [newEventIds, setNewEventIds] = useState<number[]>([])
  const [newBidsAlert, setNewBidsAlert] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const dismiss = useCallback(() => {
    setNewEventIds([])
    setNewBidsAlert(false)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const [reqs, latest] = await Promise.all([
          fetchCurrentRequirements(),
          ckanSearch<{ _id: number }>(CURRENT_ID, { limit: 1, sort: '_id desc' }),
        ])
        if (cancelled) return

        // --- New event check (requirements dataset) ---
        const ids = new Set(reqs.map((r) => Number(r['Event ID'])).filter((id) => !isNaN(id)))

        if (knownEventIds.current === null) {
          knownEventIds.current = ids
        } else {
          const newIds = [...ids].filter((id) => !knownEventIds.current!.has(id))
          if (newIds.length > 0) {
            knownEventIds.current = ids
            setNewEventIds(newIds)
            queryClient.invalidateQueries({ queryKey: ['current'] })
            queryClient.invalidateQueries({ queryKey: ['currentReqs'] })
          }
        }

        // --- New bids check (utilisation dataset) ---
        const latestId = latest.records[0]?._id ?? null

        if (lastUtilisationId.current === null) {
          lastUtilisationId.current = latestId
        } else if (latestId !== null && latestId > lastUtilisationId.current) {
          lastUtilisationId.current = latestId
          setNewBidsAlert(true)
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

  return { newEventIds, newBidsAlert, lastChecked, dismiss }
}
