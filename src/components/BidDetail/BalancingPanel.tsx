import { useBalancingActions } from '../../hooks/useBalancingActions'
import type { DfsEvent } from '../../types/dfs'
import type { BalancingPeriod } from '../../api/balancing'

function MiniBar({ value, max, className }: { value: number; max: number; className: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="mt-0.5 h-1 w-full rounded bg-gray-100">
      <div className={`h-full rounded ${className}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function PeriodRow({
  p,
  isEvent,
  maxWind,
  maxPs,
  maxBat,
}: {
  p: BalancingPeriod
  isEvent: boolean
  maxWind: number
  maxPs: number
  maxBat: number
}) {
  return (
    <tr className={`border-b border-gray-50 ${isEvent ? 'bg-blue-50' : ''}`}>
      <td className={`py-2 pr-3 font-mono text-xs whitespace-nowrap ${isEvent ? 'font-bold text-blue-700' : 'text-gray-500'}`}>
        {p.periodStartUtc}
        {isEvent && <span className="ml-1 text-blue-400 text-xs">DFS</span>}
      </td>

      <td className="py-2 px-2 text-right min-w-[72px]">
        {p.windCurtailedMW > 0 ? (
          <>
            <span className="text-xs text-amber-700 font-medium">{p.windCurtailedMW.toLocaleString()} MW</span>
            <MiniBar value={p.windCurtailedMW} max={maxWind} className="bg-amber-300" />
          </>
        ) : <span className="text-xs text-gray-300">–</span>}
      </td>

      <td className="py-2 px-2 text-right min-w-[72px]">
        {p.pumpedStorageChargingMW > 0 ? (
          <>
            <span className="text-xs text-blue-700 font-medium">{p.pumpedStorageChargingMW.toLocaleString()} MW</span>
            <MiniBar value={p.pumpedStorageChargingMW} max={maxPs} className="bg-blue-300" />
          </>
        ) : <span className="text-xs text-gray-300">–</span>}
      </td>

      <td className="py-2 px-2 text-right min-w-[72px]">
        {p.batteryChargingMW > 0 ? (
          <>
            <span className="text-xs text-green-700 font-medium">{p.batteryChargingMW.toLocaleString()} MW</span>
            <MiniBar value={p.batteryChargingMW} max={maxBat} className="bg-green-300" />
          </>
        ) : <span className="text-xs text-gray-300">–</span>}
      </td>

      <td className="py-2 pl-2 text-right min-w-[72px]">
        {p.interconnectorNetMW !== 0 ? (
          <span className={`text-xs font-medium ${p.interconnectorNetMW > 0 ? 'text-purple-700' : 'text-red-600'}`}>
            {p.interconnectorNetMW > 0 ? '+' : ''}{p.interconnectorNetMW.toLocaleString()} MW
          </span>
        ) : <span className="text-xs text-gray-300">–</span>}
      </td>
    </tr>
  )
}

export function BalancingPanel({ event }: { event: DfsEvent }) {
  const { data, eventPeriod, isLoading, error } = useBalancingActions(event)

  if (error) return null

  if (isLoading) {
    return (
      <div className="mt-4 border-t pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Grid balancing context</h3>
        <p className="mt-1 text-xs text-gray-400">Loading BM data…</p>
      </div>
    )
  }

  if (data.length === 0) return null

  const maxWind = Math.max(...data.map((d) => d.windCurtailedMW), 1)
  const maxPs   = Math.max(...data.map((d) => d.pumpedStorageChargingMW), 1)
  const maxBat  = Math.max(...data.map((d) => d.batteryChargingMW), 1)

  return (
    <div className="mt-4 border-t pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Grid balancing context</h3>
      <p className="mt-0.5 mb-2 text-xs text-gray-400">
        BM acceptances ±1 hour around this event (times UTC).
      </p>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-1 pr-3 text-xs font-medium text-gray-400">Time</th>
              <th className="pb-1 px-2 text-right text-xs font-medium text-amber-600">Wind off</th>
              <th className="pb-1 px-2 text-right text-xs font-medium text-blue-600">Pumped storage</th>
              <th className="pb-1 px-2 text-right text-xs font-medium text-green-600">Batteries</th>
              <th className="pb-1 pl-2 text-right text-xs font-medium text-purple-600">Interconnectors</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <PeriodRow
                key={p.settlementPeriod}
                p={p}
                isEvent={p.settlementPeriod === eventPeriod}
                maxWind={maxWind}
                maxPs={maxPs}
                maxBat={maxBat}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-1.5 text-xs text-gray-400">
        Wind off = curtailment instructions. Interconnectors: + = GB importing, − = exporting.
      </p>
    </div>
  )
}
