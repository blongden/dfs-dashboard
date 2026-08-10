import type { NormalisedBid, DfsEvent, ZoneNumber } from '../types/dfs'
import type { RawCurrentRequirement, RawLegacyRequirement } from '../api/requirements'
import type { RawSettlementRow } from '../api/settlement'

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
  byEventId: Map<number, { requiredMW: number; zonalCaps?: Partial<Record<ZoneNumber, number>>; submissionDeadline?: string }>
  byWindow: Map<string, { requiredMW: number; submissionDeadline?: string }>
}

export function buildCurrentReqLookup(reqs: RawCurrentRequirement[]): ReqLookup {
  const byEventId = new Map<number, { requiredMW: number; zonalCaps?: Partial<Record<ZoneNumber, number>>; submissionDeadline?: string }>()
  const byWindow = new Map<string, { requiredMW: number; submissionDeadline?: string }>()
  for (const r of reqs) {
    const caps = r['Zonal Cap'] ? parseZonalCap(r['Zonal Cap']) : undefined
    const mw = Number(r['Service Requirement MW']) || 0
    const eventId = Number(r['Event ID'])
    const deadline = r['DFS Submission Time_Local'] || undefined
    const existing = byEventId.get(eventId)
    byEventId.set(eventId, {
      requiredMW: (existing?.requiredMW ?? 0) + mw,
      zonalCaps: caps ?? existing?.zonalCaps,
      submissionDeadline: deadline ?? existing?.submissionDeadline,
    })
    const key = `${r['Delivery Date']?.slice(0, 10)}|${r.From_Local}|${r.To_Local}`
    const existingWin = byWindow.get(key)
    byWindow.set(key, { requiredMW: (existingWin?.requiredMW ?? 0) + mw, submissionDeadline: deadline ?? existingWin?.submissionDeadline })
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

      let reqData: { requiredMW?: number; zonalCaps?: Partial<Record<ZoneNumber, number>>; submissionDeadline?: string } = {}
      if (reqLookup) {
        const eventId = withEvent?.eventId
        const byId = eventId !== undefined ? reqLookup.byEventId.get(eventId) : undefined
        const byWin = reqLookup.byWindow.get(key)
        reqData = byId ?? byWin ?? {}
      }

      const clearingPricePerMWh = accepted.length > 0
        ? Math.max(...accepted.map((b) => b.pricePerMWh))
        : undefined

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
        clearingPricePerMWh,
        submissionDeadline: reqData.submissionDeadline,
      }
    })
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date)
      return dateCmp !== 0 ? dateCmp : b.from.localeCompare(a.from)
    })
}

export function mergeAnnouncedEvents(
  events: DfsEvent[],
  reqs: RawCurrentRequirement[]
): DfsEvent[] {
  const existingKeys = new Set(events.map((e) => `${e.date}|${e.from}|${e.to}`))
  const stubMap = new Map<string, DfsEvent>()

  for (const r of reqs) {
    const date = r['Delivery Date']?.slice(0, 10) ?? ''
    const from = stripSeconds(r.From_Local ?? '')
    const to = stripSeconds(r.To_Local ?? '')
    const key = `${date}|${from}|${to}`
    if (existingKeys.has(key) || !date || !from) continue

    const prev = stubMap.get(key)
    const caps = r['Zonal Cap'] ? parseZonalCap(r['Zonal Cap']) : undefined
    stubMap.set(key, {
      date,
      from,
      to,
      eventId: Number(r['Event ID']) || prev?.eventId,
      eventType: r['Event Type'] || prev?.eventType,
      requiredMW: (prev?.requiredMW ?? 0) + (Number(r['Service Requirement MW']) || 0),
      zonalCaps: caps ?? prev?.zonalCaps,
      submissionDeadline: r['DFS Submission Time_Local'] || prev?.submissionDeadline,
      totalAcceptedMW: 0,
      totalCostGBP: 0,
      acceptedCount: 0,
      rejectedCount: 0,
    })
  }

  if (stubMap.size === 0) return events

  return [...events, ...stubMap.values()].sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date)
    return dateCmp !== 0 ? dateCmp : b.from.localeCompare(a.from)
  })
}

export function applySettlement(events: DfsEvent[], rows: RawSettlementRow[]): DfsEvent[] {
  const byEventId = new Map<number, { volumeMW: number; costGBP: number }>()
  const byWindow = new Map<string, { volumeMW: number; costGBP: number }>()
  const contractedByWindow = new Map<string, number>()
  const procuredByEventId = new Map<number, number>()
  const procuredByWindow = new Map<string, number>()

  for (const r of rows) {
    const from = stripSeconds(r['From_Local'] ?? '')
    const to = stripSeconds(r['To_Local'] ?? '')
    const windowKey = `${r['Delivery Date']?.slice(0, 10)}|${from}|${to}`

    const contractedRaw = r['DFS Provider Bids Accepted Total Cost GBP']
    if (contractedRaw != null) {
      const contracted = Number(contractedRaw)
      if (!isNaN(contracted) && contracted > 0) contractedByWindow.set(windowKey, contracted)
    }

    const procuredRaw = r['DFS Procured MW']
    if (procuredRaw != null) {
      const procured = Number(procuredRaw)
      if (!isNaN(procured)) {
        const eventId = r['Event ID'] != null ? Number(r['Event ID']) : null
        if (eventId !== null) {
          procuredByEventId.set(eventId, (procuredByEventId.get(eventId) ?? 0) + procured)
        }
        procuredByWindow.set(windowKey, (procuredByWindow.get(windowKey) ?? 0) + procured)
      }
    }

    if (r['Settled Volume MW'] == null) continue
    const volumeMW = Number(r['Settled Volume MW'])
    const costGBP = Number(r['Settled Cost GBP'] ?? 0)

    const eventId = r['Event ID'] != null ? Number(r['Event ID']) : null
    if (eventId !== null) {
      const prev = byEventId.get(eventId)
      byEventId.set(eventId, {
        volumeMW: (prev?.volumeMW ?? 0) + volumeMW,
        costGBP: (prev?.costGBP ?? 0) + costGBP,
      })
    }
    const prevWin = byWindow.get(windowKey)
    byWindow.set(windowKey, {
      volumeMW: (prevWin?.volumeMW ?? 0) + volumeMW,
      costGBP: (prevWin?.costGBP ?? 0) + costGBP,
    })
  }

  return events.map((e) => {
    const windowKey = `${e.date}|${e.from}|${e.to}`
    const data =
      byWindow.get(windowKey) ??
      (e.eventId !== undefined ? byEventId.get(e.eventId) : undefined)
    const contractedCost = contractedByWindow.get(windowKey)
    const procuredMW =
      procuredByWindow.get(windowKey) ??
      (e.eventId !== undefined ? procuredByEventId.get(e.eventId) : undefined)
    if (!data && contractedCost === undefined && procuredMW === undefined) return e
    return {
      ...e,
      ...(data ? { settledVolumeMW: data.volumeMW, settledCostGBP: data.costGBP } : {}),
      ...(contractedCost !== undefined ? { totalCostGBP: contractedCost } : {}),
      ...(procuredMW !== undefined ? { procuredMW } : {}),
    }
  })
}
