import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchCurrentRequirements } from '../api/requirements'
import { ckanSearch } from '../api/client'
import { CURRENT_ID } from '../api/utilisation'
import { fetchLatestSettledId } from '../api/settlement'

const POLL_INTERVAL_MS = 60_000

function notify(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  new Notification(title, { body, icon: '/dfs-dashboard/favicon.ico' })
}

export function useEventAlerts(): {
  newEventIds: number[]
  newBidsAlert: boolean
  newSettlementAlert: boolean
  lastChecked: Date | null
  dismiss: () => void
} {
  const queryClient = useQueryClient()

  const knownEventIds = useRef<Set<number> | null>(null)
  const lastUtilisationId = useRef<number | null>(null)
  const lastSettledId = useRef<number | null>(null)

  const [newEventIds, setNewEventIds] = useState<number[]>([])
  const [newBidsAlert, setNewBidsAlert] = useState(false)
  const [newSettlementAlert, setNewSettlementAlert] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const dismiss = useCallback(() => {
    setNewEventIds([])
    setNewBidsAlert(false)
    setNewSettlementAlert(false)
  }, [])

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const [reqs, latest, latestSettledId] = await Promise.all([
          fetchCurrentRequirements(),
          ckanSearch<{ _id: number }>(CURRENT_ID, { limit: 1, sort: '_id desc' }),
          fetchLatestSettledId(),
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
            notify(
              `New DFS ${newIds.length === 1 ? 'event' : 'events'} announced`,
              newIds.map((id) => `#${id}`).join(', ')
            )
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
          notify('DFS bids updated', 'Bids accepted for an existing event')
        }

        // --- Settlement check ---
        if (lastSettledId.current === null) {
          lastSettledId.current = latestSettledId
        } else if (latestSettledId !== null && latestSettledId > lastSettledId.current) {
          lastSettledId.current = latestSettledId
          setNewSettlementAlert(true)
          queryClient.invalidateQueries({ queryKey: ['settlement'] })
          notify('DFS settlement published', 'Settlement data published for one or more events')
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

  return { newEventIds, newBidsAlert, newSettlementAlert, lastChecked, dismiss }
}
