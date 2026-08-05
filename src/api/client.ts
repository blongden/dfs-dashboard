const CKAN_BASE = import.meta.env.DEV ? '/ckan' : 'https://api.neso.energy'

export async function ckanSearch<T>(
  resourceId: string,
  params: Record<string, string | number> = {}
): Promise<{ records: T[]; total: number }> {
  const url = new URL(`${CKAN_BASE}/api/3/action/datastore_search`, window.location.href)
  url.searchParams.set('resource_id', resourceId)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`CKAN HTTP ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'CKAN error')
  return { records: json.result.records, total: json.result.total }
}
