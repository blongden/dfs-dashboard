import { useState, useEffect, useMemo } from 'react'
import type { DfsEvent } from '../../types/dfs'
import { DayGroup } from './DayGroup'
import { ErrorBanner } from '../ui/ErrorBanner'

export type HistoryTier = 'none' | 'archive2526' | 'season2324' | 'season2223'

interface Props {
  events: DfsEvent[]
  selectedKey: string | null
  onSelect: (key: string) => void
  isLoading: boolean
  error: Error | null
}

export function eventKey(e: Pick<DfsEvent, 'date' | 'from' | 'to'>) {
  return `${e.date}|${e.from}|${e.to}`
}

export function EventList({
  events,
  selectedKey,
  onSelect,
  isLoading,
  error,
}: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, DfsEvent[]>()
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, [])
      map.get(e.date)!.push(e)
    }
    // Sort slots within each day by start time ascending
    for (const slots of map.values()) {
      slots.sort((a, b) => a.from.localeCompare(b.from))
    }
    return map
  }, [events])

  const dates = useMemo(() => Array.from(grouped.keys()), [grouped])

  // Auto-expand the most recent day; re-run when the date list changes
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (dates.length > 0) {
      setExpandedDays((prev) => {
        if (prev.size > 0) return prev
        return new Set([dates[0]])
      })
    }
  }, [dates])

  function toggleDay(date: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-700">Events</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4">
            <Spinner label="Loading events…" />
          </div>
        )}
        {error && (
          <div className="p-4">
            <ErrorBanner error={error} />
          </div>
        )}
        {dates.map((date) => (
          <DayGroup
            key={date}
            date={date}
            slots={grouped.get(date)!}
            expanded={expandedDays.has(date)}
            selectedKey={selectedKey}
            onToggle={() => toggleDay(date)}
            onSelect={onSelect}
          />
        ))}
        {!isLoading && dates.length === 0 && (
          <p className="p-4 text-sm text-gray-400">No events found.</p>
        )}
      </div>
    </div>
  )
}
