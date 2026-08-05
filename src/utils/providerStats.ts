import type { NormalisedBid } from '../types/dfs'

export type Season = 'current' | 'archive2526' | 'season2324' | 'season2223'

export const SEASON_LABELS: Record<Season, string> = {
  season2223: '22/23',
  season2324: '23/24',
  archive2526: '25/26',
  current: '25/26',
}

export interface ProviderStat {
  provider: string
  totalBids: number
  acceptedBids: number
  acceptanceRate: number
  totalAcceptedMW: number
  avgBidPrice: number
  avgClearingPrice: number
  avgPriceDelta: number  // provider avg price minus event clearing price; negative = competitive
  bySeason: Partial<Record<Season, { acceptedMW: number; bids: number; accepted: number }>>
}

export function computeProviderStats(bids: NormalisedBid[]): ProviderStat[] {
  // Find clearing price (max accepted bid price) per event window
  const clearingByWindow = new Map<string, number>()
  for (const bid of bids) {
    if (bid.status !== 'Accepted') continue
    const key = `${bid.date}|${bid.from}|${bid.to}`
    const cur = clearingByWindow.get(key) ?? 0
    if (bid.pricePerMWh > cur) clearingByWindow.set(key, bid.pricePerMWh)
  }

  const map = new Map<string, {
    bids: NormalisedBid[]
    priceDeltaSum: number
    priceDeltaCount: number
  }>()

  for (const bid of bids) {
    if (!map.has(bid.provider)) map.set(bid.provider, { bids: [], priceDeltaSum: 0, priceDeltaCount: 0 })
    const entry = map.get(bid.provider)!
    entry.bids.push(bid)

    const key = `${bid.date}|${bid.from}|${bid.to}`
    const clearing = clearingByWindow.get(key)
    if (clearing !== undefined) {
      entry.priceDeltaSum += bid.pricePerMWh - clearing
      entry.priceDeltaCount++
    }
  }

  const stats: ProviderStat[] = []

  for (const [provider, { bids: provBids, priceDeltaSum, priceDeltaCount }] of map) {
    const accepted = provBids.filter((b) => b.status === 'Accepted')

    const bySeason: ProviderStat['bySeason'] = {}
    for (const bid of provBids) {
      const season: Season = (bid.source === 'archive' ? 'archive2526' : bid.source) as Season
      if (!bySeason[season]) bySeason[season] = { acceptedMW: 0, bids: 0, accepted: 0 }
      bySeason[season]!.bids++
      if (bid.status === 'Accepted') {
        bySeason[season]!.accepted++
        bySeason[season]!.acceptedMW += bid.volumeMW
      }
    }

    // Merge 'current' into 'archive2526' for display (same season)
    if (bySeason.current && bySeason.archive2526) {
      bySeason.archive2526.acceptedMW += bySeason.current.acceptedMW
      bySeason.archive2526.bids += bySeason.current.bids
      bySeason.archive2526.accepted += bySeason.current.accepted
      delete bySeason.current
    } else if (bySeason.current) {
      bySeason.archive2526 = bySeason.current
      delete bySeason.current
    }

    const clearingPrices = provBids.map((b) => {
      const key = `${b.date}|${b.from}|${b.to}`
      return clearingByWindow.get(key)
    }).filter((p): p is number => p !== undefined)

    stats.push({
      provider,
      totalBids: provBids.length,
      acceptedBids: accepted.length,
      acceptanceRate: provBids.length > 0 ? accepted.length / provBids.length : 0,
      totalAcceptedMW: accepted.reduce((s, b) => s + b.volumeMW, 0),
      avgBidPrice: provBids.reduce((s, b) => s + b.pricePerMWh, 0) / provBids.length,
      avgClearingPrice: clearingPrices.length > 0
        ? clearingPrices.reduce((s, p) => s + p, 0) / clearingPrices.length
        : 0,
      avgPriceDelta: priceDeltaCount > 0 ? priceDeltaSum / priceDeltaCount : 0,
      bySeason,
    })
  }

  return stats.sort((a, b) => b.totalAcceptedMW - a.totalAcceptedMW)
}
