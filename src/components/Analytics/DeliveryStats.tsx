import { useMemo } from 'react'
import type { DfsEvent, NormalisedBid } from '../../types/dfs'

interface Props {
  events: DfsEvent[]
  bids: NormalisedBid[]
}

interface ProviderStat {
  provider: string
  windows: number
  avgPct: number
  minPct: number
  maxPct: number
  negativeCount: number
}

function deliveryColor(pct: number): string {
  if (pct < 0) return 'text-red-600'
  if (pct < 50) return 'text-red-500'
  if (pct < 80) return 'text-amber-600'
  return 'text-green-700'
}

function deliveryBarColor(pct: number): string {
  if (pct < 50) return 'bg-red-400'
  if (pct < 80) return 'bg-amber-400'
  return 'bg-green-500'
}

export function DeliveryStats({ events, bids }: Props) {
  const stats = useMemo((): ProviderStat[] => {
    // Build settlement lookup by window key
    const settlementByWindow = new Map<string, { procuredMW: number; settledMW: number }>()
    for (const e of events) {
      if (e.procuredMW === undefined || e.settledVolumeMW === undefined) continue
      if (e.procuredMW <= 0) continue
      const key = `${e.date}|${e.from}|${e.to}`
      settlementByWindow.set(key, { procuredMW: e.procuredMW, settledMW: e.settledVolumeMW })
    }

    // Group accepted bids by window, find sole-provider windows
    const acceptedByWindow = new Map<string, Set<string>>()
    for (const b of bids) {
      if (b.status !== 'Accepted') continue
      const key = `${b.date}|${b.from}|${b.to}`
      if (!acceptedByWindow.has(key)) acceptedByWindow.set(key, new Set())
      acceptedByWindow.get(key)!.add(b.provider)
    }

    // Identify single-provider windows with settlement data
    const byProvider = new Map<string, number[]>()
    for (const [key, providers] of acceptedByWindow) {
      if (providers.size !== 1) continue
      const sett = settlementByWindow.get(key)
      if (!sett) continue
      const pct = (sett.settledMW / sett.procuredMW) * 100
      const provider = [...providers][0]
      if (!byProvider.has(provider)) byProvider.set(provider, [])
      byProvider.get(provider)!.push(pct)
    }

    return Array.from(byProvider.entries())
      .map(([provider, pcts]) => ({
        provider,
        windows: pcts.length,
        avgPct: pcts.reduce((s, p) => s + p, 0) / pcts.length,
        minPct: Math.min(...pcts),
        maxPct: Math.max(...pcts),
        negativeCount: pcts.filter((p) => p < 0).length,
      }))
      .sort((a, b) => b.windows - a.windows)
  }, [events, bids])

  if (stats.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No single-provider windows with settlement data yet.
      </div>
    )
  }

  const absMax = Math.max(...stats.map((s) => Math.abs(s.avgPct)), 100)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b px-4 py-3">
        <p className="text-xs text-gray-500">
          Delivery rate in windows where only one provider was accepted — so the settlement figure
          is attributable to them alone. Penalty threshold is 80%.
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-2 text-left">Provider</th>
              <th className="px-3 py-2 text-right w-24">Solo windows</th>
              <th className="px-3 py-2 text-right w-20">Avg</th>
              <th className="px-3 py-2 text-left">Delivery rate</th>
              <th className="px-3 py-2 text-right w-28">Range</th>
              <th className="px-3 py-2 text-right w-20">Negative</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const avgClamped = Math.max(s.avgPct, 0)
              return (
                <tr key={s.provider} className="border-b">
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                    {s.provider}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-500">
                    {s.windows}
                  </td>
                  <td className={`px-3 py-3 text-right tabular-nums font-semibold ${deliveryColor(s.avgPct)}`}>
                    {s.avgPct.toFixed(0)}%
                  </td>
                  <td className="px-3 py-3">
                    <div className="relative w-full h-3 bg-gray-100 rounded overflow-hidden">
                      {/* 80% penalty line */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-gray-400 opacity-50 z-10"
                        style={{ left: `${(80 / absMax) * 100}%` }}
                        title="80% penalty threshold"
                      />
                      <div
                        className={`h-full rounded ${deliveryBarColor(s.avgPct)}`}
                        style={{ width: `${(avgClamped / absMax) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-gray-400 tabular-nums whitespace-nowrap">
                    {s.minPct.toFixed(0)}% – {s.maxPct.toFixed(0)}%
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {s.negativeCount > 0 ? (
                      <span className="text-red-500 font-medium">{s.negativeCount}</span>
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
