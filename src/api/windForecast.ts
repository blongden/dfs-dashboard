const BASE = import.meta.env.DEV ? '/ckan' : 'https://api.neso.energy'
const WIND_ID = '342aae25-d3a6-436c-b168-db8b247ccb83'

const SCOTLAND_REGIONS = new Set([
  'ABERDEEN', 'ARGYLL', 'AYRSHIRE', 'CENTRAL',
  'DUMFRIES', 'DUMFRIES GALLOWAY', 'GALLOWAY', 'LOTHIAN', 'SSENW',
])

export interface WindSummary {
  scotland: { forecastMW: number; capacityMW: number }
  englandWales: { forecastMW: number; capacityMW: number }
}

export async function fetchWindForecast(date: string): Promise<WindSummary | null> {
  const sql = `
    SELECT "Region", AVG("Wind_Forecast") as forecast, AVG("Capacity") as capacity
    FROM "${WIND_ID}"
    WHERE "Date" = '${date}'
    GROUP BY "Region"
  `.trim()

  const res = await fetch(
    `${BASE}/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`
  )
  const json = await res.json()
  if (!json.success || json.result.records.length === 0) return null

  const summary: WindSummary = {
    scotland: { forecastMW: 0, capacityMW: 0 },
    englandWales: { forecastMW: 0, capacityMW: 0 },
  }

  for (const r of json.result.records as Record<string, unknown>[]) {
    const region = r['Region'] as string
    const forecast = Number(r['forecast'])
    const capacity = Number(r['capacity'])
    const bucket = SCOTLAND_REGIONS.has(region) ? summary.scotland : summary.englandWales
    bucket.forecastMW += forecast
    bucket.capacityMW += capacity
  }

  return summary
}
