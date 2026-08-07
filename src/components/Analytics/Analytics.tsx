import { useParams, useNavigate } from 'react-router-dom'
import type { DfsEvent, NormalisedBid } from '../../types/dfs'
import type { ProviderStat } from '../../utils/providerStats'
import { ProviderStats } from '../Providers/ProviderStats'
import { ClearingPriceChart } from './ClearingPriceChart'
import { ParticipationChart } from './ParticipationChart'
import { EventLeaderboard } from './EventLeaderboard'

type Tab = 'providers' | 'clearing' | 'participation' | 'events'

const TAB_LABELS: Record<Tab, string> = {
  providers: 'Providers',
  clearing: 'Clearing prices',
  participation: 'Participation',
  events: 'Events',
}

interface Props {
  stats: ProviderStat[]
  events: DfsEvent[]
  bids: NormalisedBid[]
}

export function Analytics({ stats, events, bids }: Props) {
  const { tab: tabParam } = useParams<{ tab?: string }>()
  const navigate = useNavigate()
  const tab: Tab =
    tabParam === 'clearing' ? 'clearing'
    : tabParam === 'participation' ? 'participation'
    : tabParam === 'events' ? 'events'
    : 'providers'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b px-4 py-2 flex gap-1">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => navigate(`/analytics/${t}`)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              tab === t ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      {tab === 'providers' ? (
        <ProviderStats stats={stats} />
      ) : tab === 'clearing' ? (
        <ClearingPriceChart events={events} />
      ) : tab === 'participation' ? (
        <ParticipationChart bids={bids} />
      ) : (
        <EventLeaderboard events={events} />
      )}
    </div>
  )
}
