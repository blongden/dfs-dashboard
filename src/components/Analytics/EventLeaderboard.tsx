import { useState, useMemo } from 'react'
import type { DfsEvent } from '../../types/dfs'

interface Props {
  events: DfsEvent[]
}

type SortKey = 'mw' | 'cost'

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function EventLeaderboard({ events }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('mw')

  const ranked = useMemo(() => {
    return events
      .filter((e) => e.totalAcceptedMW > 0)
      .sort((a, b) =>
        sortBy === 'mw'
          ? b.totalAcceptedMW - a.totalAcceptedMW
          : b.totalCostGBP - a.totalCostGBP
      )
  }, [events, sortBy])

  if (ranked.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No events with accepted bids yet. Load history to compare across seasons.
      </div>
    )
  }

  const topMW = ranked[0]?.totalAcceptedMW ?? 1
  const topCost = Math.max(...ranked.map((e) => e.totalCostGBP), 1)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <span className="text-xs text-gray-500">Rank by</span>
        {(['mw', 'cost'] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSortBy(k)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              sortBy === k ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {k === 'mw' ? 'Volume (MW)' : 'Cost (£)'}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{ranked.length} events</span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2 text-right w-10">#</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Window</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Accepted MW</th>
              <th className="px-3 py-2 text-right">Cost to NESO</th>
              <th className="px-3 py-2 text-right">Clearing £/MWh</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((e, i) => {
              const barFrac = sortBy === 'mw'
                ? e.totalAcceptedMW / topMW
                : e.totalCostGBP / topCost
              return (
                <tr key={`${e.date}|${e.from}`} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 text-right text-xs text-gray-400 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                    {formatDate(e.date)}
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap tabular-nums">
                    {e.from}–{e.to}
                  </td>
                  <td className="px-3 py-2">
                    {e.eventType ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          e.eventType === 'Downwards'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {e.eventType}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 rounded bg-gray-100 overflow-hidden hidden sm:block">
                        <div
                          className="h-full rounded bg-blue-400"
                          style={{ width: `${barFrac * 100}%` }}
                        />
                      </div>
                      <span className="font-semibold text-green-700 tabular-nums">
                        {e.totalAcceptedMW.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-700 tabular-nums">
                    £{e.totalCostGBP.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500 tabular-nums">
                    {e.clearingPricePerMWh !== undefined
                      ? `£${e.clearingPricePerMWh.toFixed(2)}`
                      : <span className="text-gray-300">—</span>}
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
