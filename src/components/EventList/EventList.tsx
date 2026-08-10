import { useState, useEffect, useMemo } from 'react'
import type { DfsEvent } from '../../types/dfs'
import { DayGroup } from './DayGroup'
import { Spinner } from '../ui/Spinner'
import { ErrorBanner } from '../ui/ErrorBanner'

export type HistoryTier = 'none' | 'archive2526' | 'season2324' | 'season2223'

interface Props {
  events: DfsEvent[]
  selectedKey: string | null
  onSelect: (key: string) => void
  isLoading: boolean
  error: Error | null
  providers?: string[]
  filterProvider: string
  onFilterProvider: (p: string) => void
  filterType: string
  onFilterType: (t: string) => void
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
  providers = [],
  filterProvider,
  onFilterProvider,
  filterType,
  onFilterType,
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
      <div className="border-b px-3 py-2 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Events</h2>
          {(filterProvider || filterType) && (
            <button
              onClick={() => { onFilterProvider(''); onFilterType('') }}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {(['', 'Downwards', 'Upwards'] as const).map((t) => (
            <button
              key={t}
              onClick={() => onFilterType(t)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                filterType === t ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {t || 'All'}
            </button>
          ))}
        </div>
        {providers.length > 0 && (
          <select
            value={filterProvider}
            onChange={(e) => onFilterProvider(e.target.value)}
            className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 truncate"
          >
            <option value="">All providers</option>
            {providers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
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
