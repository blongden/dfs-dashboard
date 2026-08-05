import { GSP_ZONES } from '../types/dfs'
import type { GspZone, NormalisedBid, ZoneNumber } from '../types/dfs'
import type { RawCurrentBid, RawLegacyBid } from '../api/utilisation'

function parseStatus(s: string): 'Accepted' | 'Rejected' {
  return s?.trim().toLowerCase() === 'accepted' ? 'Accepted' : 'Rejected'
}

// Current schema (April 2026+): one row per unit per half-hour per zone
export function normaliseCurrent(raw: RawCurrentBid): NormalisedBid {
  const zone = Number(raw.Zone) as ZoneNumber
  return {
    id: raw._id,
    date: raw['Delivery Date']?.slice(0, 10) ?? '',
    from: raw.From_Local ?? '',
    to: raw.To_Local ?? '',
    provider: raw['Registered DFS Participant'] ?? '',
    unit: raw['DFS Unit ID'] ?? '',
    volumeMW: Number(raw['DFS Procured MW']) || 0,
    pricePerMWh: Number(raw['Utilisation Price GBP per MWh']) || 0,
    status: parseStatus(raw.Status),
    source: 'current',
    eventId: Number(raw['Event ID']) || undefined,
    eventType: raw['Event Type'] ?? undefined,
    zoneData: {
      type: 'numbered',
      zone,
      zones: zone ? { [zone]: Number(raw['DFS Procured MW']) || 0 } : {},
    },
  }
}

// Archive 2025/26 and 2022/23 live: same schema, named GSP columns
// Live 2022/23 uses 'Date', 'DFS Provider', 'Unit', 'DFS Volume', 'Price'
// Archive 2025/26 uses 'Delivery Date', 'Registered DFS Participant', 'DFS Unit ID', 'DFS Volume MW', 'From', 'To', 'Utilisation Price GBP per MWh'
const LEGACY_LIVE_GSP_KEY: Record<GspZone, string> = {
  'North Scotland': 'North Scotland',
  'South and Central Scotland': 'South and Central Scotland',
  'North East England': 'North East England',
  'North West England': 'North West England',
  Yorkshire: 'Yorkshire',
  'East Midlands': 'East Midlands',
  'West Midlands': 'West Midlands',
  London: 'London',
  'East England': 'East England',
  'South East England': 'South East England',
  'South West England': 'South West England',
  'Southern England': 'Southern England',
  // 2022/23 live uses underscores; 2023/24 and archive use comma+spaces
  'North Wales Merseyside and Cheshire': 'North Wales_Merseyside_Cheshire',
  'South Wales': 'South Wales',
}

const LEGACY_ARCHIVE_GSP_KEY: Record<GspZone, string> = {
  ...LEGACY_LIVE_GSP_KEY,
  'North Wales Merseyside and Cheshire': 'North Wales Merseyside and Cheshire',
}

// 2023/24 uses comma notation
const SEASON_2324_GSP_KEY: Record<GspZone, string> = {
  ...LEGACY_LIVE_GSP_KEY,
  'North Wales Merseyside and Cheshire': 'North Wales, Merseyside and Cheshire',
}

function extractGspZones(
  raw: Record<string, unknown>,
  keyMap: Record<GspZone, string>
): Partial<Record<GspZone, number>> {
  const zones: Partial<Record<GspZone, number>> = {}
  for (const zone of GSP_ZONES) {
    const val = raw[keyMap[zone]]
    if (typeof val === 'number' && val > 0) zones[zone] = val
    else if (typeof val === 'string' && Number(val) > 0) zones[zone] = Number(val)
  }
  return zones
}

export function normaliseLegacy(
  raw: RawLegacyBid,
  source: NormalisedBid['source']
): NormalisedBid {
  const date = (raw['Delivery Date'] ?? raw.Date ?? '').slice(0, 10)
  const from = raw.From ?? ''
  const to = raw.To ?? ''
  const provider = raw['Registered DFS Participant'] ?? raw['DFS Provider'] ?? ''
  const unit = raw['DFS Unit ID'] ?? raw.Unit ?? ''
  const volumeMW = Number(raw['DFS Volume MW'] ?? raw['DFS Volume']) || 0
  const pricePerMWh = Number(raw['Utilisation Price GBP per MWh'] ?? raw.Price) || 0

  const keyMap =
    source === 'season2223'
      ? LEGACY_LIVE_GSP_KEY
      : source === 'season2324'
        ? SEASON_2324_GSP_KEY
        : LEGACY_ARCHIVE_GSP_KEY

  return {
    id: raw._id,
    date,
    from,
    to,
    provider,
    unit,
    volumeMW,
    pricePerMWh,
    status: parseStatus(raw.Status),
    source,
    zoneData: {
      type: 'gsp',
      zones: extractGspZones(raw as Record<string, unknown>, keyMap),
    },
  }
}
