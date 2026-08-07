import { useState, useMemo } from 'react'
import type { ProviderStat, Season } from '../../utils/providerStats'
import { SEASON_LABELS } from '../../utils/providerStats'

const SEASONS: Season[] = ['season2223', 'season2324', 'archive2526']

type SortKey = 'name' | 'acceptedMW' | 'acceptanceRate' | 'avgBidPrice' | 'priceDelta'

interface Props {
  stats: ProviderStat[]
}

function DeltaBadge({ delta }: { delta: number }) {
  const abs = Math.abs(delta).toFixed(2)
  if (delta < -0.5)
    return <span className="text-green-700 font-medium">−£{abs} below</span>
  if (delta > 0.5)
    return <span className="text-red-500 font-medium">+£{abs} above</span>
  return <span className="text-gray-400">at clearing</span>
}

function SeasonBar({ stat, seasons }: { stat: ProviderStat; seasons: Season[] }) {
  const values = seasons.map((s) => stat.bySeason[s]?.acceptedMW ?? 0)
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-end gap-1 h-8">
      {seasons.map((s, i) => {
        const mw = values[i]
        const height = Math.round((mw / max) * 100)
        const isLatest = s === 'archive2526'
        return (
          <div key={s} className="flex flex-col items-center gap-0.5">
            <div
              className={`w-4 rounded-t transition-all ${isLatest ? 'bg-blue-500' : 'bg-gray-200'}`}
              style={{ height: `${Math.max(height, mw > 0 ? 4 : 0)}%` }}
              title={`${SEASON_LABELS[s]}: ${mw.toFixed(0)} MW`}
            />
          </div>
        )
      })}
    </div>
  )
}

function TrendArrow({ stat, seasons }: { stat: ProviderStat; seasons: Season[] }) {
  const values = seasons.map((s) => stat.bySeason[s]?.acceptedMW ?? 0)
  const nonZero = values.filter((v) => v > 0)
  if (nonZero.length < 2) return <span className="text-gray-300">—</span>

  const first = values.find((v) => v > 0)!
  const last = [...values].reverse().find((v) => v > 0)!
  const pct = ((last - first) / first) * 100

  if (pct > 10) return <span className="text-green-600 font-medium">↑ {pct.toFixed(0)}%</span>
  if (pct < -10) return <span className="text-red-500 font-medium">↓ {Math.abs(pct).toFixed(0)}%</span>
  return <span className="text-gray-400">≈ stable</span>
}

export function ProviderStats({ stats }: Props) {
  const [sort, setSort] = useState<SortKey>('acceptedMW')
  const [asc, setAsc] = useState(false)
  const [search, setSearch] = useState('')

  const visibleSeasons = SEASONS

  const sorted = useMemo(() => {
    const filtered = search
      ? stats.filter((s) => s.provider.toLowerCase().includes(search.toLowerCase()))
      : stats

    return [...filtered].sort((a, b) => {
      let diff = 0
      if (sort === 'name') diff = a.provider.localeCompare(b.provider)
      else if (sort === 'acceptedMW') diff = a.totalAcceptedMW - b.totalAcceptedMW
      else if (sort === 'acceptanceRate') diff = a.acceptanceRate - b.acceptanceRate
      else if (sort === 'avgBidPrice') diff = a.avgBidPrice - b.avgBidPrice
      else if (sort === 'priceDelta') diff = a.avgPriceDelta - b.avgPriceDelta
      return asc ? diff : -diff
    })
  }, [stats, sort, asc, search])

  function handleSort(key: SortKey) {
    if (sort === key) setAsc((v) => !v)
    else { setSort(key); setAsc(false) }
  }

  function Th({ label, col, align = 'right' }: { label: string; col: SortKey; align?: 'left' | 'right' }) {
    const active = sort === col
    return (
      <th
        className={`cursor-pointer select-none px-3 py-2 text-xs uppercase tracking-wide text-gray-500 hover:text-gray-800 ${align === 'right' ? 'text-right' : 'text-left'}`}
        onClick={() => handleSort(col)}
      >
        {label}
        {active && <span className="ml-1 text-gray-400">{asc ? '↑' : '↓'}</span>}
      </th>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b px-4 py-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter providers…"
          className="rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-400 w-full sm:w-56"
        />
        <span className="text-xs text-gray-400">{sorted.length} providers</span>
        <span className="hidden sm:inline text-xs text-gray-400 sm:ml-auto">
          Bars: {visibleSeasons.map((s) => SEASON_LABELS[s]).join(' · ')} · blue = current · load archive to compare
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b">
              <Th label="Provider" col="name" align="left" />
              <Th label="Accepted MW" col="acceptedMW" />
              <Th label="Acceptance rate" col="acceptanceRate" />
              <Th label="Avg bid £/MWh" col="avgBidPrice" />
              <Th label="vs clearing price" col="priceDelta" />
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-gray-500">Trend</th>
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-gray-500">By season</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((stat) => (
              <tr key={stat.provider} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800 max-w-[200px] truncate" title={stat.provider}>
                  {stat.provider}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-green-700">
                  {stat.totalAcceptedMW > 0 ? stat.totalAcceptedMW.toFixed(0) : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={stat.acceptanceRate >= 0.7 ? 'text-green-700' : stat.acceptanceRate >= 0.4 ? 'text-amber-600' : 'text-red-500'}>
                    {(stat.acceptanceRate * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-gray-600">
                  £{stat.avgBidPrice.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  <DeltaBadge delta={stat.avgPriceDelta} />
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  <TrendArrow stat={stat} seasons={visibleSeasons} />
                </td>
                <td className="px-3 py-2 flex justify-end">
                  <SeasonBar stat={stat} seasons={visibleSeasons} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
