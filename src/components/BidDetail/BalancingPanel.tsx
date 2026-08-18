import { useBalancingActions } from '../../hooks/useBalancingActions'
import type { DfsEvent } from '../../types/dfs'
import type { GeoMW } from '../../api/balancing'

function GeoBar({ geo, maxMw, barColor }: { geo: GeoMW; maxMw: number; barColor: string }) {
  const totalPct = maxMw > 0 ? Math.min((geo.total / maxMw) * 100, 100) : 0
  const scotPct  = geo.total > 0 ? (geo.scotland / geo.total) * totalPct : 0
  return (
    <div className="mt-0.5 h-1.5 w-full rounded bg-gray-100 relative overflow-hidden">
      <div className={`absolute left-0 h-full rounded ${barColor}`} style={{ width: `${totalPct}%` }} />
      {geo.scotland > 0 && (
        <div className="absolute left-0 h-full rounded opacity-60 bg-white" style={{ width: `${totalPct - scotPct}%` }} />
      )}
    </div>
  )
}

function GeoLabel({ geo }: { geo: GeoMW }) {
  if (geo.scotland === 0 || geo.total === 0) return null
  return (
    <span className="text-gray-400 font-normal text-xs">
      {' '}(Scotland: {geo.scotland.toLocaleString()} MW)
    </span>
  )
}

interface StatProps {
  label: string
  geo: GeoMW
  price: number | null
  barColor: string
  maxMw: number
  textColor: string
}

function Stat({ label, geo, price, barColor, maxMw, textColor }: StatProps) {
  if (geo.total === 0) return null
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-xs font-medium ${textColor}`}>
          {label}
          <GeoLabel geo={geo} />
        </span>
        <span className="text-xs text-gray-700 font-medium tabular-nums shrink-0">
          {geo.total.toLocaleString()} MW
          {price != null && (
            <span className="ml-1 text-gray-400 font-normal">@ £{price.toFixed(0)}/MWh</span>
          )}
        </span>
      </div>
      <GeoBar geo={geo} maxMw={maxMw} barColor={barColor} />
    </div>
  )
}

// BOALF is final-settlement data, typically published ~6 weeks after the event.
const SETTLEMENT_LAG_DAYS = 45

function isSettled(eventDate: string): boolean {
  const ageDays = (Date.now() - new Date(eventDate + 'T00:00:00Z').getTime()) / 86_400_000
  return ageDays > SETTLEMENT_LAG_DAYS
}

export function BalancingPanel({ event }: { event: DfsEvent }) {
  const { data, isLoading, error } = useBalancingActions(event)
  const settled = isSettled(event.date)

  if (error) return null

  if (isLoading) {
    if (!settled) return null // skip loading state for events that won't have data anyway
    return (
      <div className="mt-4 border-t pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Grid balancing context</h3>
        <p className="mt-1 text-xs text-gray-400">Loading BM data…</p>
      </div>
    )
  }

  const p = data[0]
  const hasAny = p && (p.wind.total > 0 || p.pumpedStorage.total > 0 ||
                 p.battery.total > 0 || p.interconnectorNetMW !== 0)

  if (!hasAny) {
    if (!settled) {
      return (
        <div className="mt-4 border-t pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Grid balancing context</h3>
          <p className="mt-1 text-xs text-gray-400">
            BM acceptance data is published by Elexon after final settlement, typically around 6 weeks after the event.
          </p>
        </div>
      )
    }
    return null
  }

  const maxMw = Math.max(p.wind.total, p.pumpedStorage.total, p.battery.total, 1)

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
        <Stat label="Wind curtailed" geo={p.wind} price={p.windAvgBidPrice}
              barColor="bg-amber-300" textColor="text-amber-700" maxMw={maxMw} />
        <Stat label="Pumped storage charging" geo={p.pumpedStorage} price={p.psAvgBidPrice}
              barColor="bg-blue-300" textColor="text-blue-700" maxMw={maxMw} />
        <Stat label="Batteries charging" geo={p.battery} price={p.batteryAvgBidPrice}
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
