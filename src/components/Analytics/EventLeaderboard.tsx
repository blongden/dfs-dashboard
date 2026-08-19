import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DfsEvent } from '../../types/dfs'
import { useSortState, Th } from './SortableTable'

interface Props {
  events: DfsEvent[]
}

type SortKey = 'date' | 'mw' | 'cost' | 'price' | 'delivery'

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function toEventPath(e: DfsEvent): string {
  if (e.eventId !== undefined) return `/events/${e.eventId}-${e.from.replace(':', '')}`
  return `/events/${encodeURIComponent(`${e.date}|${e.from}|${e.to}`)}`
}

function deliveryPct(e: DfsEvent): number | undefined {
  if (e.settledVolumeMW === undefined || !e.procuredMW) return undefined
  return (e.settledVolumeMW / e.procuredMW) * 100
}

function deliveryColor(pct: number): string {
  if (pct < 0) return 'text-red-600'
  if (pct < 50) return 'text-red-500'
  if (pct < 80) return 'text-amber-600'
  return 'text-green-700'
}

export function EventLeaderboard({ events }: Props) {
  const { sortKey, asc, handleSort } = useSortState<SortKey>('mw')
  const navigate = useNavigate()

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1
    return events
      .filter((e) => e.totalAcceptedMW > 0)
      .sort((a, b) => {
        const diff =
          sortKey === 'date'
            ? (a.date + a.from).localeCompare(b.date + b.from)
            : sortKey === 'mw'
              ? a.totalAcceptedMW - b.totalAcceptedMW
              : sortKey === 'cost'
                ? a.totalCostGBP - b.totalCostGBP
                : sortKey === 'price'
                  ? (a.clearingPricePerMWh ?? 0) - (b.clearingPricePerMWh ?? 0)
                  : (deliveryPct(a) ?? -Infinity) - (deliveryPct(b) ?? -Infinity)
        return diff * dir
      })
  }, [events, sortKey, asc])

  if (sorted.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No events with accepted bids yet. Load history to compare across seasons.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b px-4 py-2 flex items-center">
        <span className="text-xs text-gray-400">{sorted.length} events</span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b">
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-gray-500 w-10">#</th>
              <Th label="Date" col="date" align="left" active={sortKey === 'date'} asc={asc} onSort={handleSort} />
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-gray-500">Window</th>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-gray-500">Type</th>
              <Th label="Accepted MW" col="mw" active={sortKey === 'mw'} asc={asc} onSort={handleSort} />
              <Th label="Cost to NESO" col="cost" active={sortKey === 'cost'} asc={asc} onSort={handleSort} />
              <Th label="Clearing £/MWh" col="price" active={sortKey === 'price'} asc={asc} onSort={handleSort} />
              <Th label="Delivery" col="delivery" active={sortKey === 'delivery'} asc={asc} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => {
              const pct = deliveryPct(e)
              return (
                <tr key={`${e.date}|${e.from}`} onClick={() => navigate(toEventPath(e))} className="border-b hover:bg-blue-50 cursor-pointer">
                  <td className="px-3 py-2 text-right text-xs text-gray-400 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatDate(e.date)}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap tabular-nums">{e.from}–{e.to}</td>
                  <td className="px-3 py-2">
                    {e.eventType ? (
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${e.eventType === 'Downwards' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {e.eventType}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-green-700 tabular-nums">
                    {e.totalAcceptedMW.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-700 tabular-nums">
                    £{e.totalCostGBP.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500 tabular-nums">
                    {e.clearingPricePerMWh !== undefined
                      ? `£${e.clearingPricePerMWh.toFixed(2)}`
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {pct !== undefined ? (
                      <span className={`font-medium ${deliveryColor(pct)}`}>{pct.toFixed(0)}%</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
