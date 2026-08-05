import { useState, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EventList, eventKey } from './components/EventList/EventList'
import type { HistoryTier } from './components/EventList/EventList'
import { BidDetail } from './components/BidDetail/BidDetail'
import { useEvents } from './hooks/useEvents'
import { useArchiveTier } from './hooks/useArchive'
import { useEventAlerts } from './hooks/useEventAlerts'
import { useTabAlert } from './hooks/useTabAlert'
import { deriveEvents } from './utils/joinEvents'
import type { NormalisedBid } from './types/dfs'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
})

function AlertBanner({
  newEventIds,
  newBidsAlert,
  onDismiss,
}: {
  newEventIds: number[]
  newBidsAlert: boolean
  onDismiss: () => void
}) {
  const messages: string[] = []
  if (newEventIds.length > 0)
    messages.push(
      `New DFS ${newEventIds.length === 1 ? 'event' : 'events'} announced: ${newEventIds.map((id) => `#${id}`).join(', ')}`
    )
  if (newBidsAlert) messages.push('Bids accepted for an existing event')

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
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [historyTier, setHistoryTier] = useState<HistoryTier>('none')

  const { events: currentEvents, bids: currentBids, isLoading, error } = useEvents()
  const { newEventIds, newBidsAlert, lastChecked, dismiss } = useEventAlerts()
  useTabAlert(newEventIds.length + (newBidsAlert ? 1 : 0))

  const archive2526 = useArchiveTier('archive2526', historyTier === 'archive2526')
  const season2324 = useArchiveTier('season2324', historyTier === 'season2324')
  const season2223 = useArchiveTier('season2223', historyTier === 'season2223')

  const activeTierData = {
    none: { bids: [] as NormalisedBid[], isLoading: false, hasNextPage: false, fetchNextPage: () => {}, isFetchingNextPage: false },
    archive2526,
    season2324,
    season2223,
  }[historyTier]

  const allBids: NormalisedBid[] = useMemo(
    () =>
      historyTier === 'none'
        ? currentBids
        : [...currentBids, ...activeTierData.bids],
    [historyTier, currentBids, activeTierData.bids]
  )

  const events = useMemo(
    () =>
      historyTier === 'none'
        ? currentEvents
        : deriveEvents(allBids, 'reqLookup' in activeTierData ? activeTierData.reqLookup : undefined),
    [historyTier, currentEvents, allBids, activeTierData]
  )

  const selectedEvent = events.find((e) => eventKey(e) === selectedKey) ?? null

  const selectedBids = useMemo(() => {
    if (!selectedKey) return []
    const [date, from, to] = selectedKey.split('|')
    return allBids.filter((b) => b.date === date && b.from === from && b.to === to)
  }, [selectedKey, allBids])

  const isLoadingHistory = activeTierData.isLoading || activeTierData.isFetchingNextPage

  return (
    <div className="flex h-screen flex-col bg-white text-gray-900 overflow-hidden">
      <header className="flex items-center justify-between border-b px-4 py-3 shadow-sm">
        <div>
          <span className="text-base font-bold text-gray-900">DFS Dashboard</span>
          <span className="ml-2 text-xs text-gray-400">National Energy System Operator</span>
        </div>
        <div className="flex items-center gap-3">
          {activeTierData.hasNextPage && (
            <button
              onClick={() => activeTierData.fetchNextPage()}
              disabled={activeTierData.isFetchingNextPage}
              className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {activeTierData.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          )}
          <span
            title={`Polling every 60s · last checked ${lastChecked ? lastChecked.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '…'}`}
            className="text-xs text-gray-400"
          >
            {lastChecked
              ? `Checked ${lastChecked.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
              : 'Checking…'}
          </span>
        </div>
      </header>

      <AlertBanner newEventIds={newEventIds} newBidsAlert={newBidsAlert} onDismiss={dismiss} />

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 flex-shrink-0 border-r overflow-hidden flex flex-col">
          <EventList
            events={events}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            isLoading={isLoading}
            error={error}
            historyTier={historyTier}
            onSetHistoryTier={setHistoryTier}
            isLoadingHistory={isLoadingHistory}
          />
        </aside>
        <main className="flex-1 overflow-hidden">
          {selectedEvent ? (
            <BidDetail event={selectedEvent} bids={selectedBids} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Select an event to see bid details.
            </div>
          )}
        </main>
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
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  )
}
