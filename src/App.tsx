import { useState, useMemo } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EventList, eventKey } from './components/EventList/EventList'
import type { HistoryTier } from './components/EventList/EventList'
import { BidDetail } from './components/BidDetail/BidDetail'
import { Analytics } from './components/Analytics/Analytics'
import { useEvents } from './hooks/useEvents'
import { useArchiveTier } from './hooks/useArchive'
import { useEventAlerts } from './hooks/useEventAlerts'
import { useTabAlert } from './hooks/useTabAlert'
import { usePageTracking } from './hooks/usePageTracking'
import { useVersionCheck } from './hooks/useVersionCheck'
import { deriveEvents } from './utils/joinEvents'
import type { ReqLookup } from './utils/joinEvents'
import { computeProviderStats } from './utils/providerStats'
import type { NormalisedBid } from './types/dfs'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
})

function AlertBanner({
  newEventIds,
  newBidsAlert,
  newSettlementAlert,
  onDismiss,
}: {
  newEventIds: number[]
  newBidsAlert: boolean
  newSettlementAlert: boolean
  onDismiss: () => void
}) {
  const messages: string[] = []
  if (newEventIds.length > 0)
    messages.push(
      `New DFS ${newEventIds.length === 1 ? 'event' : 'events'} announced: ${newEventIds.map((id) => `#${id}`).join(', ')}`
    )
  if (newBidsAlert) messages.push('Bids accepted for an existing event')
  if (newSettlementAlert) messages.push('Settlement data published for one or more events')

  if (messages.length === 0) return null

  return (
    <div className="flex items-center gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
      <span className="font-medium">{messages.join(' · ')}</span>
      <button
        onClick={onDismiss}
        className="ml-auto rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100"
      >
        Dismiss
      </button>
    </div>
  )
}

function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { eventKey: eventParam } = useParams<{ eventKey?: string }>()

  const view = location.pathname.startsWith('/analytics') ? 'analytics' : 'events'

  const [historyTier, setHistoryTier] = useState<HistoryTier>('none')
  const [filterProvider, setFilterProvider] = useState('')
  const [filterType, setFilterType] = useState('')

  usePageTracking()
  const newVersionAvailable = useVersionCheck()
  const { events: currentEvents, bids: currentBids, isLoading, error } = useEvents()
  const { newEventIds, newBidsAlert, newSettlementAlert, lastChecked, dismiss } = useEventAlerts()
  useTabAlert(newEventIds.length + (newBidsAlert ? 1 : 0) + (newSettlementAlert ? 1 : 0))

  // Each tier is cumulative: season2223 also loads 23/24 and full 25/26 archive
  const archive2526 = useArchiveTier('archive2526', historyTier !== 'none')
  const season2324 = useArchiveTier('season2324', historyTier === 'season2324' || historyTier === 'season2223')
  const season2223 = useArchiveTier('season2223', historyTier === 'season2223')

  const isLoadingHistory =
    archive2526.isLoading || archive2526.isFetchingNextPage ||
    season2324.isLoading || season2324.isFetchingNextPage ||
    season2223.isLoading || season2223.isFetchingNextPage

  const allBids: NormalisedBid[] = useMemo(() => {
    const parts: NormalisedBid[] = [...currentBids]
    if (historyTier !== 'none') parts.push(...archive2526.bids)
    if (historyTier === 'season2324' || historyTier === 'season2223') parts.push(...season2324.bids)
    if (historyTier === 'season2223') parts.push(...season2223.bids)
    return parts
  }, [historyTier, currentBids, archive2526.bids, season2324.bids, season2223.bids])

  const mergedReqLookup = useMemo((): ReqLookup | undefined => {
    if (historyTier === 'none') return undefined
    const byEventId = new Map<number, { requiredMW: number; submissionDeadline?: string }>()
    const byWindow = new Map<string, { requiredMW: number; submissionDeadline?: string }>()
    for (const lookup of [archive2526.reqLookup, season2324.reqLookup, season2223.reqLookup]) {
      if (!lookup) continue
      lookup.byEventId.forEach((v, k) => byEventId.set(k, v))
      lookup.byWindow.forEach((v, k) => byWindow.set(k, v))
    }
    return { byEventId, byWindow }
  }, [historyTier, archive2526.reqLookup, season2324.reqLookup, season2223.reqLookup])

  const events = useMemo(
    () => historyTier === 'none' ? currentEvents : deriveEvents(allBids, mergedReqLookup),
    [historyTier, currentEvents, allBids, mergedReqLookup]
  )

  // Resolve URL param to a date|from|to key
  // Formats: "{id}-{HHMM}" (e.g. 33-1730), legacy "{id}", or encoded date key
  const selectedKey = useMemo(() => {
    if (!eventParam) return null
    const idTimeMatch = eventParam.match(/^(\d+)-(\d{4})$/)
    if (idTimeMatch) {
      const id = parseInt(idTimeMatch[1])
      const time = `${idTimeMatch[2].slice(0, 2)}:${idTimeMatch[2].slice(2)}`
      const found = events.find((e) => e.eventId === id && e.from === time)
      return found ? eventKey(found) : null
    }
    if (/^\d+$/.test(eventParam)) {
      const found = events.find((e) => e.eventId === parseInt(eventParam))
      return found ? eventKey(found) : null
    }
    return decodeURIComponent(eventParam)
  }, [eventParam, events])

  const selectedEvent = selectedKey ? (events.find((e) => eventKey(e) === selectedKey) ?? null) : null

  const selectedBids = useMemo(() => {
    if (!selectedKey) return []
    const [date, from, to] = selectedKey.split('|')
    return allBids.filter((b) => b.date === date && b.from === from && b.to === to)
  }, [selectedKey, allBids])

  const providerStats = useMemo(
    () => computeProviderStats(allBids),
    [allBids]
  )

  const acceptedProvidersByWindow = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const bid of allBids) {
      if (bid.status !== 'Accepted') continue
      const key = `${bid.date}|${bid.from}|${bid.to}`
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(bid.provider)
    }
    return map
  }, [allBids])

  const providers = useMemo(() => {
    const set = new Set<string>()
    for (const ps of acceptedProvidersByWindow.values()) ps.forEach((p) => set.add(p))
    return Array.from(set).sort()
  }, [acceptedProvidersByWindow])

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterType && e.eventType !== filterType) return false
      if (filterProvider) {
        const ps = acceptedProvidersByWindow.get(`${e.date}|${e.from}|${e.to}`)
        if (!ps?.has(filterProvider)) return false
      }
      return true
    })
  }, [events, filterType, filterProvider, acceptedProvidersByWindow])

  function handleSelectEvent(key: string) {
    const event = events.find((e) => eventKey(e) === key)
    if (event?.eventId !== undefined) {
      const timeSlug = event.from.replace(':', '')
      navigate(`/events/${event.eventId}-${timeSlug}`)
    } else {
      navigate(`/events/${encodeURIComponent(key)}`)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-white text-gray-900 overflow-hidden">
      <header className="border-b px-4 py-2 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base font-bold text-gray-900 whitespace-nowrap">DFS Dashboard</span>
            <span className="hidden sm:inline text-xs text-gray-400 whitespace-nowrap">National Energy System Operator</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <button
                onClick={() => navigate('/events')}
                className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  view === 'events' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Events
              </button>
              <button
                onClick={() => navigate('/analytics/providers')}
                className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  view === 'analytics' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Analytics
              </button>
            </div>
            <select
              value={historyTier}
              onChange={(e) => setHistoryTier(e.target.value as HistoryTier)}
              className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600"
            >
              <option value="none">25/26 recent</option>
              <option value="archive2526">25/26 full</option>
              <option value="season2324">+ 23/24</option>
              <option value="season2223">+ 22/23</option>
            </select>
            {isLoadingHistory && (
              <span className="text-xs text-gray-400 whitespace-nowrap">Loading…</span>
            )}
            <span
              title={`Polling every 60s · last checked ${lastChecked ? lastChecked.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '…'}`}
              className="hidden sm:inline text-xs text-gray-400 whitespace-nowrap"
            >
              {lastChecked
                ? `Checked ${lastChecked.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                : 'Checking…'}
            </span>
          </div>
        </div>
      </header>

      {newVersionAvailable && (
        <div className="flex items-center gap-3 border-b border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          <span className="font-medium">A new version is available.</span>
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-green-700 px-3 py-0.5 text-xs font-medium text-white hover:bg-green-800"
          >
            Refresh now
          </button>
        </div>
      )}
      <AlertBanner newEventIds={newEventIds} newBidsAlert={newBidsAlert} newSettlementAlert={newSettlementAlert} onDismiss={dismiss} />

      <div className="flex min-h-0 flex-1">
        {view === 'events' ? (
          <>
            <aside className={`${selectedKey ? 'hidden sm:flex' : 'flex'} w-full sm:w-72 flex-shrink-0 border-r overflow-hidden flex-col`}>
              <EventList
                events={filteredEvents}
                selectedKey={selectedKey}
                onSelect={handleSelectEvent}
                isLoading={isLoading}
                error={error}
                providers={providers}
                filterProvider={filterProvider}
                onFilterProvider={setFilterProvider}
                filterType={filterType}
                onFilterType={setFilterType}
              />
            </aside>
            <main className={`${selectedKey ? 'flex' : 'hidden sm:flex'} flex-1 overflow-hidden flex-col`}>
              {selectedEvent ? (
                <BidDetail event={selectedEvent} bids={selectedBids} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  Select an event to see bid details.
                </div>
              )}
            </main>
          </>
        ) : (
          <main className="flex-1 overflow-hidden">
            <Analytics stats={providerStats} events={events} bids={allBids} />
          </main>
        )}
      </div>

      <footer className="flex items-center justify-between border-t px-4 py-2 text-xs text-gray-400">
        <a
          href="https://github.com/blongden/dfs-dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600"
        >
          Source on GitHub
        </a>
        {import.meta.env.VITE_APP_VERSION && (
          <span className="font-mono" title="Deployed commit SHA">
            {(import.meta.env.VITE_APP_VERSION as string).slice(0, 7)}
          </span>
        )}
        <span>
          🏴󠁧󠁢󠁳󠁣󠁴󠁿 Proudly made in Scotland by{' '}
          <a
            href="https://github.com/blongden"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600"
          >
            blongden
          </a>
        </span>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/" element={<Navigate to="/events" replace />} />
          <Route path="/events" element={<Dashboard />} />
          <Route path="/events/:eventKey" element={<Dashboard />} />
          <Route path="/analytics" element={<Navigate to="/analytics/providers" replace />} />
          <Route path="/analytics/:tab" element={<Dashboard />} />
        </Routes>
      </QueryClientProvider>
    </HashRouter>
  )
}
