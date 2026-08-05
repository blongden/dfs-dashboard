import { ckanSearch } from './client'

const CURRENT_SUMMARY_ID = '705e573c-ddac-4675-b410-82916b35c4fe'

export interface RawSettlementRow {
  _id: number
  'Event ID': number | null
  'Delivery Date': string
  'From_Local': string
  'To_Local': string
  'DFS Procured MW': string | number
  'Settled Volume MW': string | number | null
  'Settled Cost GBP': string | number | null
}

export async function fetchSettlementSummary(): Promise<RawSettlementRow[]> {
  const { records } = await ckanSearch<RawSettlementRow>(CURRENT_SUMMARY_ID, { limit: 2000 })
  return records
}

export async function fetchLatestSettledId(): Promise<number | null> {
  const BASE = import.meta.env.DEV ? '/ckan' : 'https://api.neso.energy'
  const sql = `SELECT MAX("_id") as id FROM "${CURRENT_SUMMARY_ID}" WHERE "Settled Volume MW" IS NOT NULL`
  const res = await fetch(`${BASE}/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`)
  const json = await res.json()
  const val = json.result?.records?.[0]?.id
  return val != null ? Number(val) : null
}
