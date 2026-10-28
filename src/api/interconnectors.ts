import { elexonGet } from './elexon'

export interface Interconnector {
  fuelType: string
  name: string
  to: string
  // GB landing point and a point out to sea in the direction of the far end
  land: [number, number]
  sea: [number, number]
}

export const INTERCONNECTORS: Interconnector[] = [
  { fuelType: 'INTFR',   name: 'IFA',             to: 'France',      land: [51.09, 0.97],  sea: [50.75, 1.75]  },
  { fuelType: 'INTIFA2', name: 'IFA2',            to: 'France',      land: [50.84, -1.27], sea: [50.2, -0.9]   },
  { fuelType: 'INTELEC', name: 'ElecLink',        to: 'France',      land: [51.09, 1.15],  sea: [50.9, 2.0]    },
  { fuelType: 'INTNED',  name: 'BritNed',         to: 'Netherlands', land: [51.44, 0.72],  sea: [51.9, 1.8]    },
  { fuelType: 'INTNEM',  name: 'Nemo Link',       to: 'Belgium',     land: [51.30, 1.34],  sea: [51.5, 2.4]    },
  { fuelType: 'INTVKL',  name: 'Viking Link',     to: 'Denmark',     land: [52.95, -0.15], sea: [53.2, 1.0]    },
  { fuelType: 'INTNSL',  name: 'North Sea Link',  to: 'Norway',      land: [55.13, -1.51], sea: [55.6, -0.2]   },
  { fuelType: 'INTEW',   name: 'East–West',       to: 'Ireland',     land: [53.2, -3.05],  sea: [53.3, -4.4]   },
  { fuelType: 'INTIRL',  name: 'Moyle',           to: 'N Ireland',   land: [55.1, -4.9],   sea: [55.0, -5.9]   },
  { fuelType: 'INTGRNL', name: 'Greenlink',       to: 'Ireland',     land: [51.68, -4.95], sea: [51.9, -6.1]   },
]

export interface InterconnectorFlow {
  fuelType: string
  mw: number // positive = importing to GB, negative = exporting
}

interface FuelInstRow {
  fuelType: string
  generation: number
}

// Mean flow per interconnector over the window (FUELINST, 5-minute data)
export async function fetchInterconnectorFlows(fromIso: string, toIso: string): Promise<InterconnectorFlow[]> {
  const url = new URLSearchParams({
    publishDateTimeFrom: fromIso,
    publishDateTimeTo: toIso,
  })
  for (const ic of INTERCONNECTORS) url.append('fuelType', ic.fuelType)

  const res = await elexonGet<{ data: FuelInstRow[] }>(
    `/bmrs/api/v1/datasets/FUELINST?${url.toString()}`
  )

  const sums = new Map<string, { total: number; n: number }>()
  for (const row of res.data) {
    const s = sums.get(row.fuelType) ?? { total: 0, n: 0 }
    s.total += row.generation
    s.n += 1
    sums.set(row.fuelType, s)
  }
  return [...sums].map(([fuelType, { total, n }]) => ({ fuelType, mw: total / n }))
}
