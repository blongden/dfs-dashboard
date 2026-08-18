import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DfsEvent, NormalisedBid, ZoneNumber } from '../../types/dfs'
import { BidTable } from './BidTable'
import { GspZoneGrid } from './GspZoneGrid'
import { ProviderPieChart } from './ProviderPieChart'
import { ZoneMap } from './ZoneMap'
import { ConstraintPanel } from './ConstraintPanel'
import { BalancingPanel } from './BalancingPanel'
import { useConstraints } from '../../hooks/useConstraints'
import { useBalancingActions } from '../../hooks/useBalancingActions'

interface Props {
  event: DfsEvent
  bids: NormalisedBid[]
}

type Filter = 'all' | 'accepted' | 'rejected'

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function ZonalCaps({ caps }: { caps: Partial<Record<ZoneNumber, number>> }) {
  const entries = Object.entries(caps)
    .map(([z, mw]) => ({ zone: Number(z) as ZoneNumber, mw: mw ?? 0 }))
    .filter((e) => e.mw > 0)
    .sort((a, b) => a.zone - b.zone)
  if (entries.length === 0) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(({ zone, mw }) => (
        <span key={zone} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
          Z{zone}: {mw} MW
        </span>
      ))}
    </div>
  )
}

export function BidDetail({ event, bids }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const navigate = useNavigate()
  const { data: constraintFlows = [], isLoading: constraintsLoading } = useConstraints(event)
  const { data: balancingData } = useBalancingActions(event)
  const gspActions = useMemo(() => balancingData[0]?.gspActions ?? [], [balancingData])

  const visible = bids.filter((b) => {
    if (filter === 'accepted') return b.status === 'Accepted'
    if (filter === 'rejected') return b.status === 'Rejected'
    return true
  })

  const accepted = bids.filter((b) => b.status === 'Accepted')

  const rejected = bids.filter((b) => b.status === 'Rejected')

  function priceStats(subset: NormalisedBid[]) {
    if (subset.length === 0) return null
    const prices = subset.map((b) => b.pricePerMWh)
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length
    return { avg, min: Math.min(...prices), max: Math.max(...prices) }
  }

  const acceptedStats = priceStats(accepted)
  const rejectedStats = priceStats(rejected)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b p-4">
        <div className="flex items-start gap-2">
          <button
            onClick={() => navigate('/events')}
            className="sm:hidden mr-1 mt-0.5 text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Back to events"
          >
            ←
          </button>
          <h2 className="text-base font-semibold text-gray-800">{formatDate(event.date)}</h2>
          {event.eventType && (
            <span
              className={`mt-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${
                event.eventType === 'Downwards'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {event.eventType}
            </span>
          )}
          {event.eventId !== undefined && (
            <span className="mt-0.5 text-xs text-gray-400">Event #{event.eventId}</span>
          )}
        </div>
        <div className="text-sm text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
          <span>{event.from} – {event.to}</span>
          {event.submissionDeadline && (
            <span className="text-xs text-gray-400">Bid deadline: {event.submissionDeadline}</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          {event.requiredMW !== undefined && (
            <span className="text-gray-700">
              Target: <strong>{event.requiredMW.toLocaleString()} MW</strong>
            </span>
          )}
          <span className="text-gray-700">
            Accepted:{' '}
            <strong className="text-green-700">{event.totalAcceptedMW.toFixed(1)} MW</strong>
            {' '}({event.acceptedCount} {event.acceptedCount === 1 ? 'bid' : 'bids'})
          </span>
          {event.totalCostGBP > 0 && (
            <span className="text-gray-700">
              Cost to NESO:{' '}
              <strong>£{event.totalCostGBP.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</strong>
            </span>
          )}
          {event.rejectedCount > 0 && (
            <span className="text-gray-400">
              {event.rejectedCount} {event.rejectedCount === 1 ? 'bid' : 'bids'} rejected
            </span>
          )}
          {event.settledVolumeMW !== undefined ? (
            (() => {
              const pct = event.totalAcceptedMW > 0
                ? (event.settledVolumeMW / event.totalAcceptedMW) * 100
                : 0
              const color = pct >= 95 ? 'text-green-700' : pct >= 70 ? 'text-amber-600' : 'text-red-600'
              return (
                <span className="text-gray-700">
                  Settled:{' '}
                  <strong className={color}>
                    {event.settledVolumeMW.toFixed(1)} MW
                  </strong>
                  <span className="ml-1 text-xs text-gray-400">
                    ({pct.toFixed(0)}% of contracted
                    {event.settledCostGBP !== undefined && ` · £${event.settledCostGBP.toLocaleString('en-GB', { maximumFractionDigits: 0 })} paid`})
                  </span>
                </span>
              )
            })()
          ) : event.totalAcceptedMW > 0 ? (
            <span className="text-xs text-gray-400 italic">Settlement pending</span>
          ) : null}
        </div>
        {(acceptedStats || rejectedStats) && (
          <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {acceptedStats && (
              <span className="text-gray-600">
                Accepted avg:{' '}
                <strong className="text-green-700">£{acceptedStats.avg.toFixed(2)}/MWh</strong>
                <span className="ml-1 text-xs text-gray-400">
                  (£{acceptedStats.min.toFixed(2)} – £{acceptedStats.max.toFixed(2)})
                </span>
              </span>
            )}
            {rejectedStats && (
              <span className="text-gray-600">
                Rejected avg:{' '}
                <strong className="text-red-600">£{rejectedStats.avg.toFixed(2)}/MWh</strong>
                <span className="ml-1 text-xs text-gray-400">
                  (£{rejectedStats.min.toFixed(2)} – £{rejectedStats.max.toFixed(2)})
                </span>
              </span>
            )}
          </div>
        )}
        {event.zonalCaps && Object.keys(event.zonalCaps).length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-gray-400">Zonal caps: </span>
            <ZonalCaps caps={event.zonalCaps} />
          </div>
        )}
      </div>

      {bids.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            {event.procuredMW === 0 ? (
              <>
                <p className="text-sm font-medium text-gray-600">No bids accepted</p>
                <p className="mt-1 text-xs text-gray-400">
                  NESO ran this event but accepted zero bids — 0 MW was procured.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-600">Bids not yet published</p>
                <p className="mt-1 text-xs text-gray-400">
                  This event has been announced but participation data has not been released by NESO.
                </p>
                {event.submissionDeadline && (
                  <p className="mt-2 text-xs text-gray-400">
                    Bid deadline: <span className="font-medium text-gray-600">{event.submissionDeadline}</span>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="border-b px-4 py-2 flex gap-2">
            {(['all', 'accepted', 'rejected'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-w-0">
              <ProviderPieChart bids={bids} />
              <ConstraintPanel flows={constraintFlows} isLoading={constraintsLoading} />
              <BalancingPanel event={event} />
              <GspZoneGrid bids={accepted} />
              <div className="mt-4">
                <BidTable bids={visible} />
              </div>
            </div>

            <div className="hidden sm:flex w-72 flex-shrink-0 border-l p-3 flex-col">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Zone heatmap
              </h3>
              <div className="flex-1">
                <ZoneMap bids={bids} gspActions={gspActions} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
