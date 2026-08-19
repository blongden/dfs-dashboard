import { useMemo } from 'react'
import type { DfsEvent } from '../../types/dfs'

interface Props {
  events: DfsEvent[]
}

interface MonthStat {
  month: string
  label: string
  eventCount: number
  avgClearing: number
  minClearing: number
  maxClearing: number
  totalMW: number
  isSummer: boolean
}

function computeMonthlyStats(events: DfsEvent[]): MonthStat[] {
  const map = new Map<string, { prices: number[]; mw: number }>()
  for (const e of events) {
    if (e.clearingPricePerMWh === undefined) continue
    const month = e.date.slice(0, 7)
    if (!map.has(month)) map.set(month, { prices: [], mw: 0 })
    const entry = map.get(month)!
    entry.prices.push(e.clearingPricePerMWh)
    entry.mw += e.totalAcceptedMW
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, { prices, mw }]) => {
      const monthNum = parseInt(month.slice(5, 7))
      return {
        month,
        label: new Date(month + '-15').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
        eventCount: prices.length,
        avgClearing: prices.reduce((s, p) => s + p, 0) / prices.length,
        minClearing: Math.min(...prices),
        maxClearing: Math.max(...prices),
        totalMW: mw,
        isSummer: monthNum >= 4 && monthNum <= 9,
      }
    })
}

function niceTicks(max: number, count = 5): number[] {
  const step = Math.ceil(max / count / 10) * 10
  return Array.from({ length: count + 1 }, (_, i) => i * step)
}

export function ClearingPriceChart({ events }: Props) {
  const months = useMemo(() => computeMonthlyStats(events), [events])
  const maxPrice = Math.max(...months.map((m) => m.maxClearing), 1)
  const maxEvents = Math.max(...months.map((m) => m.eventCount), 1)
  const ticks = useMemo(() => niceTicks(maxPrice), [maxPrice])
  const axisMax = ticks[ticks.length - 1]

  if (months.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No clearing price data. Load history to compare across months.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b px-4 py-3 flex items-center gap-6">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-2 rounded bg-blue-500" /> Winter (Oct–Mar)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-2 rounded bg-amber-400" /> Summer (Apr–Sep)
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-6 py-3">
        {/* Column headers */}
        <div className="flex items-end gap-3 pb-1 border-b mb-1 min-w-[480px]">
          <span className="w-20 flex-shrink-0" />
          <span className="w-32 flex-shrink-0 text-xs text-gray-400 text-center">Events / month</span>
          <span className="w-6 flex-shrink-0" />
          {/* Price axis ticks */}
          <div className="relative flex-1 h-5">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute text-xs text-gray-400 -translate-x-1/2"
                style={{ left: `${(t / axisMax) * 100}%` }}
              >
                £{t}
              </span>
            ))}
          </div>
          <span className="w-28 flex-shrink-0 text-xs text-gray-400">avg · (min–max)</span>
          <span className="w-20 flex-shrink-0 text-right text-xs text-gray-400">Total MW</span>
        </div>
        <div className="space-y-1.5 min-w-[480px]">
          {months.map((m) => {
            const avgFrac = (m.avgClearing / axisMax) * 100
            const minFrac = (m.minClearing / axisMax) * 100
            const maxFrac = (m.maxClearing / axisMax) * 100
            const freqFrac = m.eventCount / maxEvents
            return (
              <div key={m.month} className="flex items-center gap-3">
                <span className="w-20 text-xs text-gray-600 text-right flex-shrink-0">{m.label}</span>
                {/* Frequency bar */}
                <div className="w-32 flex-shrink-0 relative h-6 flex items-center">
                  <div
                    className={`absolute h-4 rounded ${m.isSummer ? 'bg-amber-300' : 'bg-blue-300'}`}
                    style={{ width: `${freqFrac * 100}%` }}
                  />
                </div>
                <span className="w-6 flex-shrink-0 text-xs text-gray-500 text-right">{m.eventCount}</span>
                {/* Price bar with axis grid + min/max ticks */}
                <div className="relative flex-1 h-6 flex items-center">
                  {/* Grid lines */}
                  {ticks.slice(1).map((t) => (
                    <div
                      key={t}
                      className="absolute top-0 bottom-0 border-l border-gray-100"
                      style={{ left: `${(t / axisMax) * 100}%` }}
                    />
                  ))}
                  {/* Avg bar */}
                  <div
                    className={`absolute h-4 rounded ${m.isSummer ? 'bg-amber-400' : 'bg-blue-500'} opacity-80`}
                    style={{ width: `${avgFrac}%` }}
                  />
                  {/* Min tick */}
                  {m.minClearing !== m.maxClearing && (
                    <div
                      className="absolute h-5 w-px bg-gray-400 opacity-60"
                      style={{ left: `${minFrac}%` }}
                      title={`Min: £${m.minClearing.toFixed(2)}`}
                    />
                  )}
                  {/* Max tick */}
                  {m.minClearing !== m.maxClearing && (
                    <div
                      className="absolute h-5 w-px bg-gray-400 opacity-60"
                      style={{ left: `${maxFrac}%` }}
                      title={`Max: £${m.maxClearing.toFixed(2)}`}
                    />
                  )}
                  {/* Range connector */}
                  {m.minClearing !== m.maxClearing && (
                    <div
                      className="absolute h-px bg-gray-300"
                      style={{ left: `${minFrac}%`, width: `${maxFrac - minFrac}%`, top: '50%' }}
                    />
                  )}
                </div>
                <span className="w-28 text-xs font-medium text-gray-700 flex-shrink-0">
                  £{m.avgClearing.toFixed(2)}
                  {m.minClearing !== m.maxClearing && (
                    <span className="ml-1 text-gray-400 font-normal">
                      ({m.minClearing.toFixed(0)}–{m.maxClearing.toFixed(0)})
                    </span>
                  )}
                </span>
                <span className="w-20 text-right text-xs text-gray-400 flex-shrink-0">
                  {m.totalMW.toFixed(0)} MW
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
