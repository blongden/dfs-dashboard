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
  nationalGridBmUnit: string
  // bid < 0 (NESO pays to reduce output), offer > 0 (NESO pays to increase output)
  bidOfferPairNumber: number
  offerVolumeAccepted: number | null
  bidVolumeAccepted: number | null
  offerPrice: number | null
  bidPrice: number | null
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
  // "HH:MM" UTC — derived from period number, not from API timestamps
  periodStartUtc: string
  windCurtailedMW: number
  windAvgBidPricePerMWh: number | null
  pumpedStorageChargingMW: number
  psAvgBidPricePerMWh: number | null
  batteryChargingMW: number
  batteryAvgBidPricePerMWh: number | null
  // positive = GB importing, negative = GB exporting
  interconnectorNetMW: number
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
  // Index BOD bid prices by BMU + period for price lookup
  // Use accepted bid price (bidPrice) where bidVolumeAccepted > 0
  const bidPrices = new Map<string, number[]>() // key: `${bmuId}:${period}`
  for (const b of bod) {
    if (b.bidPrice == null || (b.bidVolumeAccepted ?? 0) <= 0) continue
    const key = `${b.nationalGridBmUnit}:${b.settlementPeriod}`
    if (!bidPrices.has(key)) bidPrices.set(key, [])
    bidPrices.get(key)!.push(b.bidPrice)
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
    // Within each period, use the last acceptance per BMU (highest acceptanceNumber)
    // so that reversed/amended instructions don't double-count.
    const latestByBmu = new Map<string, BoalfRecord>()
    for (const r of recs) {
      const prev = latestByBmu.get(r.nationalGridBmUnit)
      if (!prev || r.acceptanceNumber > prev.acceptanceNumber) {
        latestByBmu.set(r.nationalGridBmUnit, r)
      }
    }

    let windCurtailedMW = 0
    const windPrices: number[] = []
    let pumpedStorageChargingMW = 0
    const psPrices: number[] = []
    let batteryChargingMW = 0
    const batPrices: number[] = []
    let interconnectorNetMW = 0

    for (const [bmuId, rec] of latestByBmu) {
      const bmu = bmuMap.get(bmuId)
      if (!bmu) continue
      const cat = classifyBmu(bmu)
      const delta = rec.levelFrom - rec.levelTo // positive = output reduced

      const prices = bidPrices.get(`${bmuId}:${period}`) ?? []

      if (cat === 'wind' && delta > 0) {
        windCurtailedMW += delta
        windPrices.push(...prices)
      } else if (cat === 'pumped-storage' && rec.levelTo < 0) {
        pumpedStorageChargingMW += Math.abs(rec.levelTo)
        psPrices.push(...prices)
      } else if (cat === 'battery' && rec.levelTo < 0) {
        batteryChargingMW += Math.abs(rec.levelTo)
        batPrices.push(...prices)
      } else if (cat === 'interconnector') {
        interconnectorNetMW += rec.levelTo
      }
    }

    const avg = (prices: number[]) =>
      prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / prices.length : null

    result.push({
      settlementPeriod: period,
      periodStartUtc: periodStartUtc(period),
      windCurtailedMW: Math.round(windCurtailedMW),
      windAvgBidPricePerMWh: avg(windPrices),
      pumpedStorageChargingMW: Math.round(pumpedStorageChargingMW),
      psAvgBidPricePerMWh: avg(psPrices),
      batteryChargingMW: Math.round(batteryChargingMW),
      batteryAvgBidPricePerMWh: avg(batPrices),
      interconnectorNetMW: Math.round(interconnectorNetMW),
    })
  }

  return result
}
