import { useState } from 'react'
import type { NormalisedBid, ZoneNumber } from '../../types/dfs'
import { StatusBadge } from '../ui/StatusBadge'

interface Props {
  bids: NormalisedBid[]
}

interface ProviderGroup {
  provider: string
  bids: NormalisedBid[]
  acceptedMW: number
  avgAcceptedPrice: number | null
  avgRejectedPrice: number | null
  acceptedCount: number
  rejectedCount: number
  zones: string[]
}

function zoneLabel(bid: NormalisedBid): string | null {
  if (bid.zoneData.type === 'numbered' && bid.zoneData.zone !== undefined)
    return `Z${bid.zoneData.zone}`
  if (bid.zoneData.type === 'gsp') {
    const zones = Object.keys(bid.zoneData.zones)
    return zones.length > 0 ? zones[0] : null
  }
  return null
}

function buildGroups(bids: NormalisedBid[]): ProviderGroup[] {
  const map = new Map<string, NormalisedBid[]>()
  for (const bid of bids) {
    if (!map.has(bid.provider)) map.set(bid.provider, [])
    map.get(bid.provider)!.push(bid)
  }

  return Array.from(map.entries()).map(([provider, providerBids]) => {
    const accepted = providerBids.filter((b) => b.status === 'Accepted')
    const rejected = providerBids.filter((b) => b.status === 'Rejected')

    const acceptedMW = accepted.reduce((s, b) => s + b.volumeMW, 0)

    const avgAcceptedPrice = accepted.length
      ? accepted.reduce((s, b) => s + b.pricePerMWh, 0) / accepted.length
      : null
    const avgRejectedPrice = rejected.length
      ? rejected.reduce((s, b) => s + b.pricePerMWh, 0) / rejected.length
      : null

    const zoneSet = new Set<string>()
    for (const bid of accepted) {
      const z = zoneLabel(bid)
      if (z) zoneSet.add(z)
    }
    const zones = Array.from(zoneSet).sort((a, b) => {
      const na = parseInt(a.replace('Z', ''))
      const nb = parseInt(b.replace('Z', ''))
      return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb
    })

    return {
      provider,
      bids: providerBids,
      acceptedMW,
      avgAcceptedPrice,
      avgRejectedPrice,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      zones,
    }
  }).sort((a, b) => b.acceptedMW - a.acceptedMW)
}

function ZoneChips({ zones }: { zones: string[] }) {
  if (zones.length === 0) return <span className="text-gray-300">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {zones.map((z) => (
        <span key={z} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">
          {z}
        </span>
      ))}
    </div>
  )
}

export function BidTable({ bids }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const groups = buildGroups(bids)

  function toggle(provider: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }

  if (groups.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2 text-left">Provider</th>
            <th className="px-3 py-2 text-right">Accepted MW</th>
            <th className="px-3 py-2 text-right">Avg £/MWh</th>
            <th className="px-3 py-2 text-left">Zones</th>
            <th className="px-3 py-2 text-right">Bids</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const isExpanded = expanded.has(group.provider)
            return (
              <>
                <tr
                  key={group.provider}
                  onClick={() => toggle(group.provider)}
                  className="cursor-pointer border-b hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium text-gray-800">
                    <span className="mr-1.5 text-gray-400 text-xs">{isExpanded ? '▼' : '▶'}</span>
                    {group.provider}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-green-700">
                    {group.acceptedMW > 0 ? group.acceptedMW.toFixed(1) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {group.avgAcceptedPrice !== null
                      ? `£${group.avgAcceptedPrice.toFixed(2)}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <ZoneChips zones={group.zones} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-green-700">{group.acceptedCount}✓</span>
                    {group.rejectedCount > 0 && (
                      <span className="ml-1.5 text-gray-400">{group.rejectedCount}✗</span>
                    )}
                  </td>
                </tr>

                {isExpanded &&
                  group.bids.map((bid) => (
                    <tr
                      key={bid.id}
                      className={`border-b last:border-0 bg-gray-50/60 ${
                        bid.status === 'Rejected' ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="py-1.5 pl-8 pr-3 text-xs text-gray-500">{bid.unit}</td>
                      <td className="px-3 py-1.5 text-right text-xs font-semibold">
                        {bid.volumeMW.toFixed(1)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs text-gray-500">
                        £{bid.pricePerMWh.toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-400">
                        {zoneLabel(bid) ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <StatusBadge status={bid.status} />
                      </td>
                    </tr>
                  ))}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
