import { ckanSearch } from './client'

// Current dataset (April 2026+) — new schema with numbered zones
export const CURRENT_ID = '3ebf77d7-05df-466e-a023-dc45a90efeea'
// Archive 2025/2026 — old named-column schema, through March 2026
export const ARCHIVE_2526_ID = 'cc36fff5-5f6f-4fde-8932-c935d982ecd8'
// 2023/24 season
export const SEASON_2324_ID = 'ed7019b0-32b7-425c-a2fb-5ba9e32733fb'
// 2022/23 live events (original dataset)
export const SEASON_2223_ID = '4e87244e-2479-4e6e-84c2-698dffaca41f'

export type RawCurrentBid = Record<string, unknown> & {
  _id: number
  'Event ID': number
  'Event Type': string
  'Delivery Date': string
  From_Local: string
  To_Local: string
  'Registered DFS Participant': string
  'DFS Unit ID': string
  Zone: number
  'DFS Procured MW': number
  'Utilisation Price GBP per MWh': number
  Status: string
}

// Legacy schema (2022/23, 2023/24, archive 2025/26) — named GSP columns
export type RawLegacyBid = Record<string, unknown> & {
  _id: number
  'Delivery Date'?: string
  Date?: string
  'DFS Provider'?: string
  'Registered DFS Participant'?: string
  'DFS Unit ID'?: string
  Unit?: string
  'DFS Volume MW'?: number
  'DFS Volume'?: number
  From?: string
  To?: string
  'Utilisation Price GBP per MWh'?: number
  Price?: number
  Status: string
}

const PAGE_SIZE = 1000

export async function fetchCurrent(): Promise<RawCurrentBid[]> {
  // Fetch all current records (5,000+) in pages
  const first = await ckanSearch<RawCurrentBid>(CURRENT_ID, { limit: PAGE_SIZE, offset: 0 })
  const total = first.total
  const pages = [first.records]
  const remaining = Math.ceil((total - PAGE_SIZE) / PAGE_SIZE)
  await Promise.all(
    Array.from({ length: remaining }, (_, i) =>
      ckanSearch<RawCurrentBid>(CURRENT_ID, {
        limit: PAGE_SIZE,
        offset: (i + 1) * PAGE_SIZE,
      }).then((p) => pages.push(p.records))
    )
  )
  return pages.flat()
}

export async function fetchLegacyPage(
  resourceId: string,
  offset: number
): Promise<{ records: RawLegacyBid[]; total: number }> {
  return ckanSearch<RawLegacyBid>(resourceId, { limit: PAGE_SIZE, offset })
}
