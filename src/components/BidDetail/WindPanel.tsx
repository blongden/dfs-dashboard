import type { WindSummary } from '../../api/windForecast'

interface Props {
  data: WindSummary | null | undefined
  isLoading: boolean
}

function WindBar({
  label,
  forecastMW,
  capacityMW,
}: {
  label: string
  forecastMW: number
  capacityMW: number
}) {
  const pct = capacityMW > 0 ? Math.min((forecastMW / capacityMW) * 100, 100) : 0

  const color =
    pct >= 60 ? '#2563eb'   // high output — blue
    : pct >= 35 ? '#d97706' // moderate — amber
    : '#dc2626'             // low — red

  const interpretation =
    pct >= 60 ? 'high output'
    : pct >= 35 ? 'moderate output'
    : 'low output'

  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-medium" style={{ color }}>
          {forecastMW.toLocaleString('en-GB', { maximumFractionDigits: 0 })} /{' '}
          {capacityMW.toLocaleString('en-GB', { maximumFractionDigits: 0 })} MW
          <span className="ml-1.5 text-xs font-semibold">
            {pct.toFixed(0)}% — {interpretation}
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.8 }}
        />
      </div>
    </div>
  )
}

export function WindPanel({ data, isLoading }: Props) {
  if (isLoading) return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Wind generation
      </h3>
      <p className="text-xs text-gray-400">Loading…</p>
    </div>
  )

  if (!data) return null

  const scotPct = data.scotland.capacityMW > 0
    ? (data.scotland.forecastMW / data.scotland.capacityMW) * 100
    : 0
  const ewPct = data.englandWales.capacityMW > 0
    ? (data.englandWales.forecastMW / data.englandWales.capacityMW) * 100
    : 0

  let insight: string | null = null
  if (scotPct >= 60 && ewPct < 50)
    insight = 'Scotland generating strongly while England & Wales output is moderate — high Scotland-to-England export pressure likely.'
  else if (scotPct < 35 && ewPct >= 50)
    insight = 'Low Scottish wind with reasonable output in England & Wales — England may need to export north, stressing the import direction of SCOTEX.'
  else if (scotPct >= 60 && ewPct >= 60)
    insight = 'High wind across Great Britain — overall system long on generation.'
  else if (scotPct < 35 && ewPct < 35)
    insight = 'Low wind across Great Britain — system likely relying on dispatchable generation.'

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Wind generation (day average)
      </h3>
      {insight && (
        <p className="mb-2 text-xs text-gray-500">{insight}</p>
      )}
      <div className="space-y-2.5">
        <WindBar
          label="Scotland"
          forecastMW={data.scotland.forecastMW}
          capacityMW={data.scotland.capacityMW}
        />
        <WindBar
          label="England & Wales"
          forecastMW={data.englandWales.forecastMW}
          capacityMW={data.englandWales.capacityMW}
        />
      </div>
    </div>
  )
}
