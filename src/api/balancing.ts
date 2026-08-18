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
  levelFrom: number   // MW lower bound of this bid/offer step
  levelTo: number     // MW upper bound of this bid/offer step
  pairId: number      // negative = bid (turn-down), positive = offer (turn-up)
  bid: number         // bid price £/MWh (what NESO pays to turn down)
  offer: number       // offer price £/MWh (what NESO pays to turn up)
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
}

// ── Classification ────────────────────────────────────────────────────────────

export type BmuCategory = 'wind' | 'pumped-storage' | 'battery' | 'interconnector' | 'other'

export function classifyBmu(bmu: BmuRef): BmuCategory {
  if (bmu.fuelType === 'WIND') return 'wind'
  if (bmu.fuelType === 'PS') return 'pumped-storage'
  if (bmu.fuelType?.startsWith('INT') || bmu.interconnectorId) return 'interconnector'
  // Batteries register as fuelType='OTHER' with symmetric charge/discharge capacity
  if (bmu.fuelType === 'OTHER' && parseFloat(bmu.demandCapacity || '0') < -5) return 'battery'
  return 'other'
}

// ── Aggregated output ─────────────────────────────────────────────────────────

export interface BalancingPeriod {
  settlementPeriod: number
  periodStartUtc: string  // "HH:MM" UTC derived from period number
  windCurtailedMW: number
  windAvgBidPrice: number | null
  pumpedStorageChargingMW: number
  psAvgBidPrice: number | null
  batteryChargingMW: number
  batteryAvgBidPrice: number | null
  interconnectorNetMW: number
}

function periodStartUtc(period: number): string {
  const mins = (period - 1) * 30
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}

// Find the weighted-average bid price for a BOALF acceptance against the BOD ladder.
// BOALF says: output moved from levelFrom → levelTo (a bid = output was reduced).
// BOD bid steps (pairId < 0) define the price at each MW output range.
// We find all BOD steps whose range overlaps [levelTo, levelFrom] and weight by overlap.
function matchBidPrice(
  bmuId: string,
  levelFrom: number,
  levelTo: number,
  bodByBmu: Map<string, BodRecord[]>
): number | null {
  const lo = Math.min(levelFrom, levelTo)
  const hi = Math.max(levelFrom, levelTo)
  const steps = bodByBmu.get(bmuId)?.filter((b) => b.pairId < 0) ?? []
  let totalMw = 0
  let weightedPrice = 0
  for (const step of steps) {
    const overlapLo = Math.max(lo, step.levelFrom)
    const overlapHi = Math.min(hi, step.levelTo)
    if (overlapHi <= overlapLo) continue
    const mw = overlapHi - overlapLo
    totalMw += mw
    weightedPrice += step.bid * mw
  }
  return totalMw > 0 ? weightedPrice / totalMw : null
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
  // Index BOD by BMU for price lookups
  const bodByBmu = new Map<string, BodRecord[]>()
  for (const b of bod) {
    if (!bodByBmu.has(b.nationalGridBmUnit)) bodByBmu.set(b.nationalGridBmUnit, [])
    bodByBmu.get(b.nationalGridBmUnit)!.push(b)
  }

  // Group BOALF by settlement period
  const byPeriod = new Map<number, BoalfRecord[]>()
  for (const r of boalf) {
    const p = r.settlementPeriodFrom
    if (!byPeriod.has(p)) byPeriod.set(p, [])
    byPeriod.get(p)!.push(r)
  }

  const result: BalancingPeriod[] = []

  for (const [period, recs] of [...byPeriod.entries()].sort(([a], [b]) => a - b)) {
    // Use the last acceptance per BMU to avoid double-counting amended instructions
    const latestByBmu = new Map<string, BoalfRecord>()
    for (const r of recs) {
      const prev = latestByBmu.get(r.nationalGridBmUnit)
      if (!prev || r.acceptanceNumber > prev.acceptanceNumber) {
        latestByBmu.set(r.nationalGridBmUnit, r)
      }
    }

    let windMW = 0, windPriceTotal = 0, windPriceMw = 0
    let psMW = 0, psPriceTotal = 0, psPriceMw = 0
    let batMW = 0, batPriceTotal = 0, batPriceMw = 0
    let interconnectorNetMW = 0

    for (const [bmuId, rec] of latestByBmu) {
      const bmu = bmuMap.get(bmuId)
      if (!bmu) continue
      const cat = classifyBmu(bmu)
      const delta = rec.levelFrom - rec.levelTo // positive = output was reduced (bid action)

      if (cat === 'wind' && delta > 0) {
        const price = matchBidPrice(bmuId, rec.levelFrom, rec.levelTo, bodByBmu)
        windMW += delta
        if (price != null) { windPriceTotal += price * delta; windPriceMw += delta }
      } else if (cat === 'pumped-storage' && rec.levelTo < 0) {
        const price = matchBidPrice(bmuId, rec.levelFrom, rec.levelTo, bodByBmu)
        psMW += Math.abs(rec.levelTo)
        if (price != null) { psPriceTotal += price * Math.abs(rec.levelTo); psPriceMw += Math.abs(rec.levelTo) }
      } else if (cat === 'battery' && rec.levelTo < 0) {
        const price = matchBidPrice(bmuId, rec.levelFrom, rec.levelTo, bodByBmu)
        batMW += Math.abs(rec.levelTo)
        if (price != null) { batPriceTotal += price * Math.abs(rec.levelTo); batPriceMw += Math.abs(rec.levelTo) }
      } else if (cat === 'interconnector') {
        interconnectorNetMW += rec.levelTo
      }
    }

    result.push({
      settlementPeriod: period,
      periodStartUtc: periodStartUtc(period),
      windCurtailedMW: Math.round(windMW),
      windAvgBidPrice: windPriceMw > 0 ? windPriceTotal / windPriceMw : null,
      pumpedStorageChargingMW: Math.round(psMW),
      psAvgBidPrice: psPriceMw > 0 ? psPriceTotal / psPriceMw : null,
      batteryChargingMW: Math.round(batMW),
      batteryAvgBidPrice: batPriceMw > 0 ? batPriceTotal / batPriceMw : null,
      interconnectorNetMW: Math.round(interconnectorNetMW),
    })
  }

  return result
}
