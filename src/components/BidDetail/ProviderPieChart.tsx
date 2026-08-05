import type { NormalisedBid } from '../../types/dfs'

interface Props {
  bids: NormalisedBid[]
}

const COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#6366f1',
  '#0d9488', '#b45309',
]

interface Slice {
  provider: string
  mw: number
  color: string
  startAngle: number
  endAngle: number
}

function polarToXY(angle: number, r: number, cx: number, cy: number) {
  const rad = (angle - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToXY(startAngle, r, cx, cy)
  const end = polarToXY(endAngle, r, cx, cy)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
}

export function ProviderPieChart({ bids }: Props) {
  const accepted = bids.filter((b) => b.status === 'Accepted')
  if (accepted.length === 0) return null

  // Aggregate by provider
  const totals = new Map<string, number>()
  for (const bid of accepted) {
    totals.set(bid.provider, (totals.get(bid.provider) ?? 0) + bid.volumeMW)
  }

  const sorted = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
  const total = sorted.reduce((s, [, mw]) => s + mw, 0)

  if (sorted.length === 0 || total === 0) return null

  // Build slices
  const slices: Slice[] = []
  let angle = 0
  for (let i = 0; i < sorted.length; i++) {
    const [provider, mw] = sorted[i]
    const sweep = (mw / total) * 360
    slices.push({
      provider,
      mw,
      color: COLORS[i % COLORS.length],
      startAngle: angle,
      endAngle: angle + sweep,
    })
    angle += sweep
  }

  const cx = 60
  const cy = 60
  const r = 50

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Provider capacity
      </h3>
      <div className="flex items-start gap-4">
        <svg width={120} height={120} viewBox="0 0 120 120" className="flex-shrink-0">
          {slices.length === 1 ? (
            <circle cx={cx} cy={cy} r={r} fill={slices[0].color}>
              <title>
                {slices[0].provider}: {slices[0].mw.toFixed(1)} MW (100%)
              </title>
            </circle>
          ) : (
            slices.map((slice) => (
              <path
                key={slice.provider}
                d={describeArc(cx, cy, r, slice.startAngle, slice.endAngle)}
                fill={slice.color}
                stroke="white"
                strokeWidth={1.5}
              >
                <title>
                  {slice.provider}: {slice.mw.toFixed(1)} MW ({((slice.mw / total) * 100).toFixed(1)}%)
                </title>
              </path>
            ))
          )}
        </svg>

        <div className="flex-1 space-y-1">
          {slices.map((slice) => (
            <div key={slice.provider} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                style={{ backgroundColor: slice.color }}
              />
              <span className="flex-1 truncate text-gray-700" title={slice.provider}>
                {slice.provider}
              </span>
              <span className="text-gray-500">{slice.mw.toFixed(1)} MW</span>
              <span className="w-9 text-right text-gray-400">
                {((slice.mw / total) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
