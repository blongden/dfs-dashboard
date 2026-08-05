import type { DfsEvent } from '../../types/dfs'
import { eventKey } from './EventList'

interface Props {
  date: string
  slots: DfsEvent[]
  expanded: boolean
  selectedKey: string | null
  onToggle: () => void
  onSelect: (key: string) => void
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function DayGroup({ date, slots, expanded, selectedKey, onToggle, onSelect }: Props) {
  const totalAcceptedMW = slots.reduce((s, e) => s + e.totalAcceptedMW, 0)
  const totalRequired = slots.reduce((s, e) => s + (e.requiredMW ?? 0), 0)
  const totalCostGBP = slots.reduce((s, e) => s + e.totalCostGBP, 0)
  const eventTypes = [...new Set(slots.map((s) => s.eventType).filter(Boolean))]
  const hasSelected = slots.some((s) => eventKey(s) === selectedKey)

  return (
    <div className={`border-b ${hasSelected ? 'bg-blue-50/40' : ''}`}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">{formatDate(date)}</span>
            {eventTypes.map((t) => (
              <span
                key={t}
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  t === 'Downwards' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {t}
              </span>
            ))}
          </div>
          <span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
        <div className="mt-0.5 flex gap-3 text-xs text-gray-500">
          <span>{slots.length} {slots.length === 1 ? 'slot' : 'slots'}</span>
          {totalRequired > 0 && <span>Target: {totalRequired.toLocaleString()} MW</span>}
          {totalAcceptedMW > 0 && (
            <span className="text-green-700">{totalAcceptedMW.toFixed(1)} MW accepted</span>
          )}
          {totalCostGBP > 0 && (
            <span className="text-gray-500">£{totalCostGBP.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t">
          {slots.map((slot) => {
            const key = eventKey(slot)
            const selected = selectedKey === key
            return (
              <button
                key={key}
                onClick={() => onSelect(key)}
                className={`w-full border-b last:border-0 px-4 py-2 text-left transition-colors hover:bg-blue-50 border-l-4 ${
                  selected
                    ? 'border-l-blue-500 bg-blue-50'
                    : 'border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {slot.from} – {slot.to}
                  </span>
                  {slot.eventId !== undefined && (
                    <span className="text-xs text-gray-300">#{slot.eventId}</span>
                  )}
                </div>
                <div className="flex gap-3 text-xs text-gray-500">
                  {slot.requiredMW !== undefined && (
                    <span>Target: {slot.requiredMW.toLocaleString()} MW</span>
                  )}
                  {slot.totalAcceptedMW > 0 && (
                    <span className="text-green-700">
                      {slot.totalAcceptedMW.toFixed(1)} MW accepted
                    </span>
                  )}
                  {slot.rejectedCount > 0 && (
                    <span className="text-gray-400">{slot.rejectedCount} rejected</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
