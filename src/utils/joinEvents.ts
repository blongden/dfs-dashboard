import type { NormalisedBid, DfsEvent, ZoneNumber } from '../types/dfs'
import type { RawCurrentRequirement, RawLegacyRequirement } from '../api/requirements'

function parseZonalCap(raw: string): Partial<Record<ZoneNumber, number>> {
  // Format: "Z1:0,Z2:0,Z3:0,Z4:500,..."
  const caps: Partial<Record<ZoneNumber, number>> = {}
  for (const part of raw.split(',')) {
    const [key, val] = part.trim().split(':')
    const zone = Number(key?.replace('Z', '')) as ZoneNumber
    const mw = Number(val)
    if (zone >= 1 && zone <= 12 && mw > 0) caps[zone] = mw
  }
  return caps
}

// Strip seconds from time strings like "17:30:00" → "17:30"
function stripSeconds(t: string): string {
  return t?.slice(0, 5) ?? ''
}

export interface ReqLookup {
  byEventId: Map<number, { requiredMW: number; zonalCaps?: Partial<Record<ZoneNumber, number>> }>
  byWindow: Map<string, { requiredMW: number }>
}

export function buildCurrentReqLookup(reqs: RawCurrentRequirement[]): ReqLookup {
  const byEventId = new Map<number, { requiredMW: number; zonalCaps?: Partial<Record<ZoneNumber, number>> }>()
  const byWindow = new Map<string, { requiredMW: number }>()
  for (const r of reqs) {
    const caps = r['Zonal Cap'] ? parseZonalCap(r['Zonal Cap']) : undefined
    const mw = Number(r['Service Requirement MW']) || 0
    const eventId = Number(r['Event ID'])
    // Sum MW across multiple rows with the same Event ID (e.g. distinct service types)
    const existing = byEventId.get(eventId)
    byEventId.set(eventId, {
      requiredMW: (existing?.requiredMW ?? 0) + mw,
      zonalCaps: caps ?? existing?.zonalCaps,
    })
    const key = `${r['Delivery Date']?.slice(0, 10)}|${r.From_Local}|${r.To_Local}`
    const existingWin = byWindow.get(key)
    byWindow.set(key, { requiredMW: (existingWin?.requiredMW ?? 0) + mw })
  }
  return { byEventId, byWindow }
}

export function buildLegacyReqLookup(reqs: RawLegacyRequirement[]): ReqLookup {
  const byWindow = new Map<string, { requiredMW: number }>()
  for (const r of reqs) {
    const date = r['Delivery Date']?.slice(0, 10) ?? ''
    const from = stripSeconds(r.From ?? '')
    const to = stripSeconds(r.To ?? '')
    const mw = Number(r['Service Requirement MW'] ?? r['DFS Required MW']) || 0
    byWindow.set(`${date}|${from}|${to}`, { requiredMW: mw })
  }
  return { byEventId: new Map(), byWindow }
}

export function deriveEvents(bids: NormalisedBid[], reqLookup?: ReqLookup): DfsEvent[] {
  const byWindow = new Map<string, NormalisedBid[]>()
  for (const bid of bids) {
    const key = `${bid.date}|${bid.from}|${bid.to}`
    if (!byWindow.has(key)) byWindow.set(key, [])
    byWindow.get(key)!.push(bid)
  }

  return Array.from(byWindow.entries())
    .map(([key, windowBids]) => {
      const [date, from, to] = key.split('|')
      const accepted = windowBids.filter((b) => b.status === 'Accepted')
      const withEvent = windowBids.find((b) => b.eventId !== undefined)

      let reqData: { requiredMW?: number; zonalCaps?: Partial<Record<ZoneNumber, number>> } = {}
      if (reqLookup) {
        const eventId = withEvent?.eventId
        const byId = eventId !== undefined ? reqLookup.byEventId.get(eventId) : undefined
        const byWin = reqLookup.byWindow.get(key)
        reqData = byId ?? byWin ?? {}
      }

      return {
        date,
        from,
        to,
        eventId: withEvent?.eventId,
        eventType: withEvent?.eventType,
        requiredMW: reqData.requiredMW,
        zonalCaps: reqData.zonalCaps,
        totalAcceptedMW: accepted.reduce((s, b) => s + b.volumeMW, 0),
        // Each bid covers a 30-minute window: MW × 0.5h × £/MWh = £
        totalCostGBP: accepted.reduce((s, b) => s + b.volumeMW * 0.5 * b.pricePerMWh, 0),
        acceptedCount: accepted.length,
        rejectedCount: windowBids.length - accepted.length,
      }
    })
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date)
      return dateCmp !== 0 ? dateCmp : b.from.localeCompare(a.from)
    })
}
