import { GSP_ZONES } from '../../types/dfs'
import type { GspZone, NormalisedBid, ZoneNumber } from '../../types/dfs'

interface Props {
  bids: NormalisedBid[]
  showTitle?: boolean
}

const GSP_SHORT: Record<GspZone, string> = {
  'North Scotland': 'N Scotland',
  'South and Central Scotland': 'S&C Scotland',
  'North East England': 'NE England',
  'North West England': 'NW England',
  Yorkshire: 'Yorkshire',
  'East Midlands': 'E Midlands',
  'West Midlands': 'W Midlands',
  London: 'London',
  'East England': 'E England',
  'South East England': 'SE England',
  'South West England': 'SW England',
  'Southern England': 'S England',
  'North Wales Merseyside and Cheshire': 'N Wales/Mersey',
  'South Wales': 'S Wales',
}

function ZoneBadge({ label, mw, intensity }: { label: string; mw: number; intensity: number }) {
  return (
    <span
      title={`${label}: ${mw.toFixed(1)} MW`}
      className="rounded-full px-3 py-1 text-xs font-medium"
      style={{
        backgroundColor: `rgba(37, 99, 235, ${0.1 + intensity * 0.9})`,
        color: intensity > 0.6 ? '#fff' : '#1e3a5f',
      }}
    >
      {label} · {mw.toFixed(1)} MW
    </span>
  )
}

export function GspZoneGrid({ bids, showTitle = true }: Props) {
  const hasNumbered = bids.some((b) => b.zoneData.type === 'numbered')
  const hasGsp = bids.some((b) => b.zoneData.type === 'gsp')

  if (!hasNumbered && !hasGsp) return null

  return (
    <div className={showTitle ? 'mt-4' : undefined}>
      {showTitle && (
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Zone volumes (accepted bids)
        </h3>
      )}
      <div className="flex flex-wrap gap-2">
        {hasNumbered && <NumberedZones bids={bids} />}
        {hasGsp && <GspZones bids={bids} />}
      </div>
    </div>
  )
}

function NumberedZones({ bids }: { bids: NormalisedBid[] }) {
  const totals: Partial<Record<ZoneNumber, number>> = {}
  for (const bid of bids) {
    if (bid.zoneData.type !== 'numbered') continue
    for (const [z, v] of Object.entries(bid.zoneData.zones)) {
      const zn = Number(z) as ZoneNumber
      totals[zn] = (totals[zn] ?? 0) + (v ?? 0)
    }
  }
  const entries = Object.entries(totals)
    .map(([z, mw]) => ({ zone: Number(z) as ZoneNumber, mw: mw ?? 0 }))
    .filter((e) => e.mw > 0)
    .sort((a, b) => a.zone - b.zone)
  if (entries.length === 0) return null
  const max = Math.max(...entries.map((e) => e.mw), 1)
  return (
    <>
      {entries.map(({ zone, mw }) => (
        <ZoneBadge key={zone} label={`Zone ${zone}`} mw={mw} intensity={mw / max} />
      ))}
    </>
  )
}

function GspZones({ bids }: { bids: NormalisedBid[] }) {
  const totals: Partial<Record<GspZone, number>> = {}
  for (const bid of bids) {
    if (bid.zoneData.type !== 'gsp') continue
    for (const zone of GSP_ZONES) {
      const v = bid.zoneData.zones[zone]
      if (v) totals[zone] = (totals[zone] ?? 0) + v
    }
  }
  const active = GSP_ZONES.filter((z) => (totals[z] ?? 0) > 0)
  if (active.length === 0) return null
  const max = Math.max(...active.map((z) => totals[z] ?? 0), 1)
  return (
    <>
      {active.map((zone) => (
        <ZoneBadge
          key={zone}
          label={GSP_SHORT[zone]}
          mw={totals[zone] ?? 0}
          intensity={(totals[zone] ?? 0) / max}
        />
      ))}
    </>
  )
}
