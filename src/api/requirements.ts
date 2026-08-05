import { ckanSearch } from './client'

// Current (April 2026+)
const CURRENT_REQ_ID = '3635fd80-49d7-4d02-964d-cc8c08d50302'
// Archive 2025/26
const ARCHIVE_2526_REQ_ID = 'f5605e2b-b677-424c-8df7-d0ce4ee03cef'
// 2023/24
const SEASON_2324_REQ_ID = '7914dd99-fe1c-41ba-9989-5784531c58bb'
// 2022/23
const SEASON_2223_REQ_ID = '663f3f82-fec8-4c9a-a837-df5db8690a6f'

export interface RawCurrentRequirement {
  _id: number
  'Event ID': number
  'Event Type': string
  'Event Tag': string
  'Delivery Date': string
  From_Local: string
  To_Local: string
  'Service Requirement MW': number
  'Service Requirement Type': string
  'Guaranteed Acceptance Price GBP per MWh': number
  'Zonal Cap': string
  'Participant Bids Eligible': string
}

export interface RawLegacyRequirement {
  _id: number
  'Delivery Date': string
  From: string
  To: string
  'Service Requirement MW'?: number
  'DFS Required MW'?: number
  'Service Requirement Type': string
  'Guaranteed Acceptance Price GBP per MWh': number
}

export async function fetchCurrentRequirements(): Promise<RawCurrentRequirement[]> {
  const { records } = await ckanSearch<RawCurrentRequirement>(CURRENT_REQ_ID, { limit: 2000 })
  return records
}

export async function fetchLegacyRequirements(
  tier: 'archive2526' | 'season2324' | 'season2223'
): Promise<RawLegacyRequirement[]> {
  const id =
    tier === 'archive2526'
      ? ARCHIVE_2526_REQ_ID
      : tier === 'season2324'
        ? SEASON_2324_REQ_ID
        : SEASON_2223_REQ_ID
  const { records } = await ckanSearch<RawLegacyRequirement>(id, { limit: 2000 })
  return records
}
