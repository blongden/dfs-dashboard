const ELEXON_BASE = import.meta.env.DEV ? '/elexon' : 'https://data.elexon.co.uk'

export async function elexonGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${ELEXON_BASE}${path}`, window.location.href)
  url.searchParams.set('format', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Elexon HTTP ${res.status}`)
  return res.json()
}
