const BASE = import.meta.env.DEV ? '/ckan' : 'https://api.neso.energy'
const FLOWS_ID = '38a18ec1-9e40-465d-93fb-301e80fd1352'

// Boundaries most relevant to DFS zone exclusion decisions
const KEY_CONSTRAINTS = ['SCOTEX', 'SSHARN3', 'FLOWSTH', 'SSE_SP2']

// NESO publishes 10000 / 99999 as a placeholder where a boundary has no active limit
const NO_LIMIT_MW = 9999

export interface ConstraintFlow {
  group: string
  flowMW: number
  limitMW: number
}

export async function fetchConstraintFlows(
  date: string, // YYYY-MM-DD
  from: string,  // HH:MM (local time, matches Date (GMT/BST) field)
  to: string,    // HH:MM
): Promise<ConstraintFlow[]> {
  const groups = KEY_CONSTRAINTS.map((g) => `'${g}'`).join(',')
  const sql = `
    SELECT "Constraint Group", AVG("Limit_MW") as "Limit_MW", AVG("Flow_MW") as "Flow_MW"
    FROM "${FLOWS_ID}"
    WHERE "Constraint Group" IN (${groups})
      AND "Date_ Time GMT_BST" >= '${date}T${from}:00'
      AND "Date_ Time GMT_BST" < '${date}T${to}:00'
    GROUP BY "Constraint Group"
  `.trim()

  const res = await fetch(
    `${BASE}/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`
  )
  const json = await res.json()
  if (!json.success) return []

  return (json.result.records as Record<string, unknown>[])
    .map((r) => ({
      group: r['Constraint Group'] as string,
      flowMW: Number(r['Flow_MW']),
      limitMW: Number(r['Limit_MW']),
    }))
    .filter((f) => f.limitMW > 0 && f.limitMW < NO_LIMIT_MW)
}
