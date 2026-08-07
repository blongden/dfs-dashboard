// Legacy GSP zones used in 2022/23 and 2023/24 datasets
export const GSP_ZONES = [
  'North Scotland',
  'South and Central Scotland',
  'North East England',
  'North West England',
  'Yorkshire',
  'East Midlands',
  'West Midlands',
  'London',
  'East England',
  'South East England',
  'South West England',
  'Southern England',
  'North Wales Merseyside and Cheshire',
  'South Wales',
] as const

export type GspZone = (typeof GSP_ZONES)[number]

// NESO introduced numbered zones (1-12) from April 2026. No official names are published.
export type ZoneNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export type ZoneData =
  | { type: 'numbered'; zones: Partial<Record<ZoneNumber, number>>; zone?: ZoneNumber }
  | { type: 'gsp'; zones: Partial<Record<GspZone, number>> }

export interface NormalisedBid {
  id: number
  date: string
  from: string
  to: string
  provider: string
  unit: string
  volumeMW: number
  pricePerMWh: number
  status: 'Accepted' | 'Rejected'
  source: 'current' | 'archive' | 'season2324' | 'season2223'
  eventId?: number
  eventType?: string
  zoneData: ZoneData
}

export interface DfsEvent {
  date: string
  from: string
  to: string
  eventId?: number
  eventType?: string
  requiredMW?: number
  zonalCaps?: Partial<Record<ZoneNumber, number>>
  totalAcceptedMW: number
  totalCostGBP: number
  acceptedCount: number
  rejectedCount: number
  submissionDeadline?: string   // bid deadline from requirements, e.g. "14/04/2026 12:00"
  clearingPricePerMWh?: number  // max accepted bid price for this window; undefined if no bids accepted
  settledVolumeMW?: number      // undefined = pending, negative = customers increased consumption
  settledCostGBP?: number
  procuredMW?: number           // from settlement summary; 0 = auction ran but nothing accepted, undefined = not yet in settlement data
}
