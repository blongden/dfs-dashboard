import type { ConstraintFlow } from '../../api/constraints'

interface Props {
  flows: ConstraintFlow[]
  isLoading: boolean
}

const LABELS: Record<string, string> = {
  SCOTEX:   'Scotland export (SCOTEX)',
  SSHARN3:  'S Scotland boundary (SSHARN3)',
  'SSE-SP2': 'SSE / SP boundary',
  FLOWSTH:  'Southern England flows',
}

function statusColor(ratio: number): string {
  if (ratio >= 1.0) return '#dc2626'  // red — over limit
  if (ratio >= 0.85) return '#d97706' // amber — near limit
  return '#16a34a'                    // green — clear
}

function statusLabel(ratio: number): string {
  if (ratio > 1.0) return 'OVER LIMIT'
  if (ratio === 1.0) return 'AT LIMIT'
  if (ratio >= 0.85) return 'NEAR LIMIT'
  return 'within limit'
}

function ConstraintBar({ flow }: { flow: ConstraintFlow }) {
  const ratio = flow.limitMW > 0 ? flow.flowMW / flow.limitMW : 0
  const barPct = Math.min(ratio * 100, 100)
  const overPct = ratio > 1 ? Math.min((ratio - 1) * 100, 50) : 0
  const color = statusColor(ratio)
  const label = LABELS[flow.group] ?? flow.group

  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-medium" style={{ color }}>
          {flow.flowMW.toLocaleString('en-GB', { maximumFractionDigits: 0 })} /{' '}
          {flow.limitMW.toLocaleString('en-GB', { maximumFractionDigits: 0 })} MW
          <span className="ml-1.5 text-xs font-semibold">{statusLabel(ratio)}</span>
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-gray-100">
        {/* Bar up to 100% limit */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${barPct}%`, backgroundColor: color, opacity: 0.8 }}
        />
        {/* Overflow bar beyond limit */}
        {overPct > 0 && (
          <div
            className="absolute inset-y-0 rounded-full"
            style={{ left: '100%', width: `${overPct}%`, backgroundColor: '#dc2626' }}
          />
        )}
        {/* Limit marker */}
        <div className="absolute inset-y-0 w-px bg-gray-400" style={{ left: '100%' }} />
      </div>
    </div>
  )
}

export function ConstraintPanel({ flows, isLoading }: Props) {
  if (isLoading) return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Grid constraints
      </h3>
      <p className="text-xs text-gray-400">Loading…</p>
    </div>
  )

  if (flows.length === 0) return null

  const hasBinding = flows.some((f) => f.limitMW > 0 && f.flowMW / f.limitMW >= 0.85)
  const scotexBinding = flows.find(
    (f) => f.group === 'SCOTEX' && f.limitMW > 0 && f.flowMW / f.limitMW >= 0.85
  )

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Grid constraints
      </h3>
      {hasBinding && (
        <p className="mb-2 text-xs text-gray-500">
          {scotexBinding
            ? 'Scotland export boundary is at or over its day-ahead limit — reducing Scottish demand would push more power through an already-strained constraint, so Scottish zones are excluded.'
            : 'One or more transmission constraints are at or near their day-ahead limit during this event window.'}
        </p>
      )}
      <div className="space-y-2.5">
        {flows
          .sort((a, b) => {
            const ra = a.limitMW > 0 ? a.flowMW / a.limitMW : 0
            const rb = b.limitMW > 0 ? b.flowMW / b.limitMW : 0
            return rb - ra
          })
          .map((f) => (
            <ConstraintBar key={f.group} flow={f} />
          ))}
      </div>
    </div>
  )
}
