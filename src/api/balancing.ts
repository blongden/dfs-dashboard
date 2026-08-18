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
  pumpedStorageChargingMW: number
  batteryChargingMW: number
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

// ── Aggregation ───────────────────────────────────────────────────────────────

export function aggregateByPeriod(
  boalf: BoalfRecord[],
  bmuMap: Map<string, BmuRef>
): BalancingPeriod[] {
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
    let pumpedStorageChargingMW = 0
    let batteryChargingMW = 0
    let interconnectorNetMW = 0

    for (const [bmuId, rec] of latestByBmu) {
      const bmu = bmuMap.get(bmuId)
      if (!bmu) continue
      const cat = classifyBmu(bmu)
      const delta = rec.levelFrom - rec.levelTo // positive = output reduced

      if (cat === 'wind' && delta > 0) {
        windCurtailedMW += delta
      } else if (cat === 'pumped-storage' && rec.levelTo < 0) {
        pumpedStorageChargingMW += Math.abs(rec.levelTo)
      } else if (cat === 'battery' && rec.levelTo < 0) {
        batteryChargingMW += Math.abs(rec.levelTo)
      } else if (cat === 'interconnector') {
        interconnectorNetMW += rec.levelTo
      }
    }

    result.push({
      settlementPeriod: period,
      periodStartUtc: periodStartUtc(period),
      windCurtailedMW: Math.round(windCurtailedMW),
      pumpedStorageChargingMW: Math.round(pumpedStorageChargingMW),
      batteryChargingMW: Math.round(batteryChargingMW),
      interconnectorNetMW: Math.round(interconnectorNetMW),
    })
  }

  return result
}
