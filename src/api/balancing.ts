import { elexonGet } from './elexon'

// ── Raw API types ─────────────────────────────────────────────────────────────

export interface BoalfRecord {
  settlementDate: string
  settlementPeriodFrom: number
  settlementPeriodTo: number
  timeFrom: string
  timeTo: string
  levelFrom: number
  levelTo: number
  acceptanceNumber: number
  nationalGridBmUnit: string
  bmUnit: string
}

export interface BodRecord {
  settlementDate: string
  settlementPeriod: number
  timeFrom: string
  timeTo: string
  levelFrom: number   // boundary point for this bid/offer step (levelFrom === levelTo)
  levelTo: number
  pairId: number      // negative = bid (turn-down price), positive = offer (turn-up price)
  bid: number         // £/MWh NESO pays to turn down
  offer: number       // £/MWh NESO pays to turn up
  nationalGridBmUnit: string
  bmUnit: string
}

export interface BmuRef {
  nationalGridBmUnit: string
  fuelType: string | null
  demandCapacity: string
  generationCapacity: string
  interconnectorId: string | null
  bmUnitName: string
  gspGroupId: string | null
  gspGroupName: string | null
  transmissionLossFactor: string | null
}

// ── Classification ────────────────────────────────────────────────────────────

export type BmuCategory = 'wind' | 'pumped-storage' | 'battery' | 'interconnector' | 'other'

export function classifyBmu(bmu: BmuRef): BmuCategory {
  if (bmu.fuelType === 'WIND') return 'wind'
  if (bmu.fuelType === 'PS') return 'pumped-storage'
  if (bmu.fuelType?.startsWith('INT') || bmu.interconnectorId) return 'interconnector'
  if (bmu.fuelType === 'OTHER' && parseFloat(bmu.demandCapacity || '0') < -5) return 'battery'
  return 'other'
}

// Infer GSP group for T_ units that have no gspGroupId, using TLF as a proxy.
// Scottish transmission nodes are in surplus and have strongly negative TLF.
function effectiveGspGroup(bmu: BmuRef): string | null {
  if (bmu.gspGroupId) return bmu.gspGroupId
  if (bmu.transmissionLossFactor != null) {
    const tlf = parseFloat(bmu.transmissionLossFactor)
    if (tlf < -0.015) return '_P' // North Scotland
    if (tlf < -0.003) return '_N' // South Scotland
  }
  return null
}

function isScottish(bmu: BmuRef): boolean {
  // Embedded units carry a GSP group — use that where available.
  if (bmu.gspGroupId === '_N' || bmu.gspGroupId === '_P') return true
  if (bmu.gspGroupName?.toLowerCase().includes('scotland')) return true
  // Transmission-connected units (T_ prefix) have no GSP group. Fall back to
  // transmissionLossFactor: Scottish nodes are in generation surplus and have a
  // negative TLF, typically below -0.003. English/Welsh T_ nodes are positive or
  // very slightly negative.
  if (bmu.gspGroupId === null && bmu.transmissionLossFactor != null) {
    return parseFloat(bmu.transmissionLossFactor) < -0.003
  }
  return false
}

// ── Price matching ────────────────────────────────────────────────────────────

// BOD uses point boundaries (levelFrom === levelTo), not ranges.
// Each pairId marks the upper MW limit of that bid step.
// For levelTo >= 0 (curtailment in positive output): find the lowest positive pairId
// whose boundary >= levelTo — that step contains the instructed level.
// For levelTo < 0 (charging below zero): find the highest negative pairId
// whose boundary <= levelTo.
function matchBidPrice(
  bmuId: string,
  levelTo: number,
  bodByBmu: Map<string, BodRecord[]>
): number | null {
  const steps = bodByBmu.get(bmuId) ?? []
  if (levelTo >= 0) {
    const match = steps
      .filter((s) => s.pairId >= 1 && s.levelFrom >= levelTo)
      .sort((a, b) => a.pairId - b.pairId)[0]
    return match?.bid ?? null
  } else {
    const match = steps
      .filter((s) => s.pairId < 0 && s.levelFrom <= levelTo)
      .sort((a, b) => b.pairId - a.pairId)[0]
    return match?.bid ?? null
  }
}

// ── Aggregated output ─────────────────────────────────────────────────────────

export interface GeoMW {
  total: number
  scotland: number
}

// Per-GSP-group MW totals for map markers
export type ActionCategory = 'wind' | 'pumped-storage' | 'battery'
export interface GspAction {
  gspGroupId: string
  category: ActionCategory
  mw: number
}

export interface BalancingPeriod {
  settlementPeriod: number
  periodStartUtc: string
  wind: GeoMW
  windAvgBidPrice: number | null
  pumpedStorage: GeoMW
  psAvgBidPrice: number | null
  battery: GeoMW
  batteryAvgBidPrice: number | null
  interconnectorNetMW: number
  gspActions: GspAction[]
}

function periodStartUtc(period: number): string {
  const mins = (period - 1) * 30
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchBmuReference(): Promise<Map<string, BmuRef>> {
  const data = await elexonGet<BmuRef[]>('/bmrs/api/v1/reference/bmunits/all')
  return new Map(data.map((b) => [b.nationalGridBmUnit, b]))
}

export async function fetchBoalf(from: string, to: string): Promise<BoalfRecord[]> {
  const res = await elexonGet<{ data: BoalfRecord[] }>('/bmrs/api/v1/datasets/BOALF', { from, to })
  return res.data
}

export async function fetchBod(from: string, to: string): Promise<BodRecord[]> {
  const res = await elexonGet<{ data: BodRecord[] }>('/bmrs/api/v1/datasets/BOD', { from, to })
  return res.data
}

// ── Aggregation ───────────────────────────────────────────────────────────────

export function aggregateByPeriod(
  boalf: BoalfRecord[],
  bod: BodRecord[],
  bmuMap: Map<string, BmuRef>
): BalancingPeriod[] {
  const bodByBmu = new Map<string, BodRecord[]>()
  for (const b of bod) {
    if (!bodByBmu.has(b.nationalGridBmUnit)) bodByBmu.set(b.nationalGridBmUnit, [])
    bodByBmu.get(b.nationalGridBmUnit)!.push(b)
  }

  const byPeriod = new Map<number, BoalfRecord[]>()
  for (const r of boalf) {
    const p = r.settlementPeriodFrom
    if (!byPeriod.has(p)) byPeriod.set(p, [])
    byPeriod.get(p)!.push(r)
  }

  const result: BalancingPeriod[] = []

  for (const [period, recs] of [...byPeriod.entries()].sort(([a], [b]) => a - b)) {
    const latestByBmu = new Map<string, BoalfRecord>()
    for (const r of recs) {
      const prev = latestByBmu.get(r.nationalGridBmUnit)
      if (!prev || r.acceptanceNumber > prev.acceptanceNumber) {
        latestByBmu.set(r.nationalGridBmUnit, r)
      }
    }

    const wind: GeoMW = { total: 0, scotland: 0 }
    let windPriceTotal = 0, windPriceMw = 0

    const ps: GeoMW = { total: 0, scotland: 0 }
    let psPriceTotal = 0, psPriceMw = 0

    const bat: GeoMW = { total: 0, scotland: 0 }
    let batPriceTotal = 0, batPriceMw = 0

    let interconnectorNetMW = 0
    // Accumulate MW per GSP group per action category for map markers
    const gspMw = new Map<string, Map<ActionCategory, number>>()

    for (const [bmuId, rec] of latestByBmu) {
      const bmu = bmuMap.get(bmuId)
      if (!bmu) continue
      const cat = classifyBmu(bmu)
      const scottish = isScottish(bmu)
      const delta = rec.levelFrom - rec.levelTo
      const gsp = effectiveGspGroup(bmu)

      const addGsp = (category: ActionCategory, mw: number) => {
        if (!gsp) return
        if (!gspMw.has(gsp)) gspMw.set(gsp, new Map())
        const prev = gspMw.get(gsp)!.get(category) ?? 0
        gspMw.get(gsp)!.set(category, prev + mw)
      }

      if (cat === 'wind' && delta > 0) {
        const price = matchBidPrice(bmuId, rec.levelTo, bodByBmu)
        wind.total += delta
        if (scottish) wind.scotland += delta
        if (price != null) { windPriceTotal += price * delta; windPriceMw += delta }
        addGsp('wind', delta)
      } else if (cat === 'pumped-storage' && rec.levelTo < 0) {
        const mw = Math.abs(rec.levelTo)
        const price = matchBidPrice(bmuId, rec.levelTo, bodByBmu)
        ps.total += mw
        if (scottish) ps.scotland += mw
        if (price != null) { psPriceTotal += price * mw; psPriceMw += mw }
        addGsp('pumped-storage', mw)
      } else if (cat === 'battery' && rec.levelTo < 0) {
        const mw = Math.abs(rec.levelTo)
        const price = matchBidPrice(bmuId, rec.levelTo, bodByBmu)
        bat.total += mw
        if (scottish) bat.scotland += mw
        if (price != null) { batPriceTotal += price * mw; batPriceMw += mw }
        addGsp('battery', mw)
      } else if (cat === 'interconnector') {
        interconnectorNetMW += rec.levelTo
      }
    }

    const gspActions: GspAction[] = []
    for (const [gspGroupId, catMap] of gspMw) {
      for (const [category, mw] of catMap) {
        gspActions.push({ gspGroupId, category, mw: Math.round(mw) })
      }
    }

    result.push({
      settlementPeriod: period,
      periodStartUtc: periodStartUtc(period),
      wind: { total: Math.round(wind.total), scotland: Math.round(wind.scotland) },
      windAvgBidPrice: windPriceMw > 0 ? windPriceTotal / windPriceMw : null,
      pumpedStorage: { total: Math.round(ps.total), scotland: Math.round(ps.scotland) },
      psAvgBidPrice: psPriceMw > 0 ? psPriceTotal / psPriceMw : null,
      battery: { total: Math.round(bat.total), scotland: Math.round(bat.scotland) },
      batteryAvgBidPrice: batPriceMw > 0 ? batPriceTotal / batPriceMw : null,
      interconnectorNetMW: Math.round(interconnectorNetMW),
      gspActions,
    })
  }

  return result
}
