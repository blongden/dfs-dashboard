import { useMemo, useState } from 'react'
import type { NormalisedBid } from '../../types/dfs'

type Granularity = 'month' | 'week' | 'event'

interface Props {
  bids: NormalisedBid[]
}

function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().slice(0, 10)
}

function periodKey(bid: NormalisedBid, gran: Granularity): string {
  if (gran === 'month') return bid.date.slice(0, 7)
  if (gran === 'week') return weekStart(bid.date)
  return `${bid.date}|${bid.from}`
}

function periodLabel(key: string, gran: Granularity): string {
  if (gran === 'month')
    return new Date(key + '-15').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
  if (gran === 'week')
    return new Date(key + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const [date, time] = key.split('|')
  return `${new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`
}

function cellColor(mw: number, max: number): string {
  if (mw === 0 || max === 0) return '#f1f5f9'
  const t = Math.min(mw / max, 1)
  const r = Math.round(219 - t * 169)
  const g = Math.round(234 - t * 157)
  const b = Math.round(254 - t * 56)
  return `rgb(${r},${g},${b})`
}

const MAX_EVENT_COLS = 60

function computeGrid(bids: NormalisedBid[], gran: Granularity) {
  const accepted = bids.filter((b) => b.status === 'Accepted')

  const periodSet = new Set<string>()
  const cells = new Map<string, number>()
  const providerTotals = new Map<string, number>()

  for (const bid of accepted) {
    const period = periodKey(bid, gran)
    periodSet.add(period)
    const key = `${bid.provider}||${period}`
    cells.set(key, (cells.get(key) ?? 0) + bid.volumeMW)
    providerTotals.set(bid.provider, (providerTotals.get(bid.provider) ?? 0) + bid.volumeMW)
  }

  let periods = Array.from(periodSet).sort()
  if (gran === 'event') periods = periods.slice(-MAX_EVENT_COLS)

  const providers = Array.from(providerTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([p]) => p)

  // Per-provider max for self-normalised colour scale
  const providerMax = new Map<string, number>()
  for (const provider of providers) {
    providerMax.set(
      provider,
      Math.max(...periods.map((p) => cells.get(`${provider}||${p}`) ?? 0), 1)
    )
  }

  return { periods, providers, cells, providerMax }
}

export function ParticipationChart({ bids }: Props) {
  const [granularity, setGranularity] = useState<Granularity>('month')

  const { periods, providers, cells, providerMax } = useMemo(
    () => computeGrid(bids, granularity),
    [bids, granularity]
  )

  const rotateLabels = granularity !== 'month'
  const cellW = granularity === 'month' ? 44 : granularity === 'week' ? 36 : 28

  if (providers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No accepted bids to display. Load history to compare across time.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <span className="text-xs text-gray-500">Accepted MW per provider — colour normalised per row</span>
        <div className="flex gap-1 ml-3">
          {(['month', 'week', 'event'] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`rounded px-2 py-0.5 text-xs font-medium capitalize transition-colors ${
                granularity === g ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-400">
          Top {providers.length} providers · {periods.length} {granularity}s
          {granularity === 'event' && periods.length === MAX_EVENT_COLS ? ` (most recent ${MAX_EVENT_COLS})` : ''}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="text-xs border-separate border-spacing-0 min-w-full">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="sticky left-0 z-20 bg-white px-3 text-left text-gray-400 font-normal border-b border-r w-48 min-w-[12rem]">
                Provider
              </th>
              {periods.map((p) => (
                <th
                  key={p}
                  className="text-gray-400 font-normal border-b px-0.5"
                  style={{
                    width: cellW,
                    minWidth: cellW,
                    height: rotateLabels ? 80 : 32,
                    verticalAlign: 'bottom',
                    paddingBottom: 4,
                  }}
                >
                  <div
                    style={
                      rotateLabels
                        ? { writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }
                        : { textAlign: 'center', whiteSpace: 'nowrap' }
                    }
                  >
                    {periodLabel(p, granularity)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => (
              <tr key={provider} className="hover:bg-gray-50/50">
                <td
                  className="sticky left-0 bg-white px-3 py-1 text-gray-700 font-medium border-r truncate max-w-[12rem]"
                  title={provider}
                >
                  {provider}
                </td>
                {periods.map((period) => {
                  const mw = cells.get(`${provider}||${period}`) ?? 0
                  const max = providerMax.get(provider) ?? 1
                  return (
                    <td key={period} className="p-0.5" title={mw > 0 ? `${mw.toFixed(0)} MW` : undefined}>
                      <div
                        className="rounded"
                        style={{
                          width: cellW - 4,
                          height: 22,
                          background: cellColor(mw, max),
                        }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
