import { useBalancingActions } from '../../hooks/useBalancingActions'
import type { DfsEvent } from '../../types/dfs'

interface StatProps {
  label: string
  mw: number
  price: number | null
  barColor: string
  maxMw: number
  textColor: string
}

function Stat({ label, mw, price, barColor, maxMw, textColor }: StatProps) {
  if (mw === 0) return null
  const pct = maxMw > 0 ? Math.min((mw / maxMw) * 100, 100) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-xs font-medium ${textColor}`}>{label}</span>
        <span className="text-xs text-gray-700 font-medium tabular-nums">
          {mw.toLocaleString()} MW
          {price != null && (
            <span className="ml-1 text-gray-400 font-normal">@ £{price.toFixed(0)}/MWh</span>
          )}
        </span>
      </div>
      <div className="mt-0.5 h-1.5 w-full rounded bg-gray-100">
        <div className={`h-full rounded ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function BalancingPanel({ event }: { event: DfsEvent }) {
  const { data, isLoading, error } = useBalancingActions(event)

  if (error) return null

  if (isLoading) {
    return (
      <div className="mt-4 border-t pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Grid balancing context</h3>
        <p className="mt-1 text-xs text-gray-400">Loading BM data…</p>
      </div>
    )
  }

  // There will be exactly one period (the event window)
  const p = data[0]
  if (!p) return null

  const hasAny = p.windCurtailedMW > 0 || p.pumpedStorageChargingMW > 0 ||
                 p.batteryChargingMW > 0 || p.interconnectorNetMW !== 0
  if (!hasAny) return null

  const maxMw = Math.max(p.windCurtailedMW, p.pumpedStorageChargingMW, p.batteryChargingMW, 1)

  return (
    <div className="mt-4 border-t pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Grid balancing context</h3>
      <p className="mt-0.5 mb-3 text-xs text-gray-400">
        Other BM actions during this event window.
        {event.clearingPricePerMWh != null && (
          <span className="ml-1">DFS clearing price: <span className="font-medium text-gray-600">£{event.clearingPricePerMWh.toFixed(0)}/MWh</span>.</span>
        )}
      </p>

      <div className="flex flex-col gap-2.5">
        <Stat label="Wind curtailed" mw={p.windCurtailedMW} price={p.windAvgBidPrice}
              barColor="bg-amber-300" textColor="text-amber-700" maxMw={maxMw} />
        <Stat label="Pumped storage charging" mw={p.pumpedStorageChargingMW} price={p.psAvgBidPrice}
              barColor="bg-blue-300" textColor="text-blue-700" maxMw={maxMw} />
        <Stat label="Batteries charging" mw={p.batteryChargingMW} price={p.batteryAvgBidPrice}
              barColor="bg-green-300" textColor="text-green-700" maxMw={maxMw} />
        {p.interconnectorNetMW !== 0 && (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-purple-700">Interconnectors</span>
              <span className={`text-xs font-medium tabular-nums ${p.interconnectorNetMW > 0 ? 'text-purple-700' : 'text-red-600'}`}>
                {p.interconnectorNetMW > 0 ? '+' : ''}{p.interconnectorNetMW.toLocaleString()} MW
                <span className="ml-1 text-xs text-gray-400 font-normal">
                  ({p.interconnectorNetMW > 0 ? 'importing' : 'exporting'})
                </span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
