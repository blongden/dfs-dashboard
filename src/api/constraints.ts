const BASE = import.meta.env.DEV ? '/ckan' : 'https://api.neso.energy'
const FLOWS_ID = '38a18ec1-9e40-465d-93fb-301e80fd1352'

// Boundaries most relevant to DFS zone exclusion decisions
const KEY_CONSTRAINTS = ['SCOTEX', 'SSHARN3', 'FLOWSTH', 'SSE-SP2']

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
    SELECT "Constraint Group", "Limit (MW)", AVG("Flow (MW)") as "Flow (MW)"
    FROM "${FLOWS_ID}"
    WHERE "Constraint Group" IN (${groups})
      AND "Date (GMT/BST)" >= '${date} ${from}:00'
      AND "Date (GMT/BST)" < '${date} ${to}:00'
    GROUP BY "Constraint Group", "Limit (MW)"
  `.trim()

  const res = await fetch(
    `${BASE}/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`
  )
  const json = await res.json()
  if (!json.success) return []

  return (json.result.records as Record<string, unknown>[]).map((r) => ({
    group: r['Constraint Group'] as string,
    flowMW: Number(r['Flow (MW)']),
    limitMW: Number(r['Limit (MW)']),
  }))
}
