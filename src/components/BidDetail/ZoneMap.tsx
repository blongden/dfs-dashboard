import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { NormalisedBid, ZoneNumber } from '../../types/dfs'
import type { GspAction } from '../../api/balancing'
import { GSP_CENTROIDS } from '../../data/gspGroups'

interface Props {
  bids: NormalisedBid[]
  gspActions?: GspAction[]
  height?: number | string
}

// Inferred short labels from centroid analysis of the GeoJSON
const ZONE_LABELS: Record<ZoneNumber, string> = {
  1: 'N Scotland',
  2: 'C/W Scotland',
  3: 'S/E Scotland',
  4: 'NE England',
  5: 'NW England & N Wales',
  6: 'W Midlands',
  7: 'Yorkshire & Humber',
  8: 'Wales & Bristol',
  9: 'SW England',
  10: 'S Central England',
  11: 'East of England',
  12: 'London & SE',
}

function interpolateColor(t: number): string {
  // 0 = light blue-grey, 1 = deep blue
  const r = Math.round(219 - t * 169)
  const g = Math.round(234 - t * 157)
  const b = Math.round(254 - t * 56)
  return `rgb(${r},${g},${b})`
}

const CATEGORY_STYLE: Record<GspAction['category'], { color: string; label: string; latOffset: number; lngOffset: number }> = {
  'wind':          { color: '#f59e0b', label: 'Wind curtailed',       latOffset:  0.15, lngOffset:  0    },
  'pumped-storage':{ color: '#3b82f6', label: 'Pumped storage chg',   latOffset: -0.15, lngOffset:  0.2  },
  'battery':       { color: '#22c55e', label: 'Batteries charging',   latOffset: -0.15, lngOffset: -0.2  },
}

export function ZoneMap({ bids, gspActions = [], height = '100%' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  const accepted = bids.filter((b) => b.status === 'Accepted')

  // Aggregate accepted MW per zone
  const zoneMW = new Map<number, number>()
  for (const bid of accepted) {
    if (bid.zoneData.type === 'numbered' && bid.zoneData.zone !== undefined) {
      const z = bid.zoneData.zone
      zoneMW.set(z, (zoneMW.get(z) ?? 0) + bid.volumeMW)
    }
  }

  const maxMW = Math.max(0, ...zoneMW.values())

  useEffect(() => {
    if (!containerRef.current) {
      // Container removed (no accepted bids) — destroy so it re-initialises when it returns
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      return
    }

    // Initialise map once
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
      })
    }

    const map = mapRef.current
    const abortController = new AbortController()

    // Clear existing layers
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer)
    })

    const zonesPromise = fetch(`${import.meta.env.BASE_URL}dfs-zones.geojson`, { signal: abortController.signal }).then((r) => r.json())
    const boundariesPromise = fetch(`${import.meta.env.BASE_URL}etys-boundaries.geojson`, { signal: abortController.signal }).then((r) => r.json())

    Promise.all([zonesPromise, boundariesPromise])
      .then(([zonesGeoJSON, boundariesGeoJSON]) => {
        if (abortController.signal.aborted) return

        const geoLayer = L.geoJSON(zonesGeoJSON, {
          style: (feature) => {
            const zone = feature?.properties?.Region as number
            const mw = zoneMW.get(zone) ?? 0
            const t = maxMW > 0 ? mw / maxMW : 0
            return {
              fillColor: t > 0 ? interpolateColor(t) : '#f1f5f9',
              fillOpacity: t > 0 ? 0.85 : 0.4,
              color: '#94a3b8',
              weight: 1,
            }
          },
          onEachFeature: (feature, layer) => {
            const zone = feature.properties?.Region as ZoneNumber
            const mw = zoneMW.get(zone) ?? 0
            const label = ZONE_LABELS[zone] ?? `Zone ${zone}`
            layer.bindTooltip(
              `<strong>Zone ${zone}</strong><br/>${label}${mw > 0 ? `<br/>${mw.toFixed(1)} MW accepted` : '<br/>No accepted bids'}`,
              { sticky: true, className: 'dfs-zone-tooltip' }
            )
          },
        }).addTo(map)

        L.geoJSON(boundariesGeoJSON, {
          style: (feature) => ({
            color: feature?.properties?.color ?? '#6b7280',
            weight: 2,
            dashArray: '6 4',
            fillOpacity: 0,
            opacity: 0.85,
          }),
          onEachFeature: (feature, layer) => {
            const { label, desc } = feature?.properties ?? {}
            if (label) layer.bindTooltip(
              `<div style="max-width:160px;white-space:normal"><strong>${label}</strong><br/>${desc}</div>`,
              { sticky: true, className: 'dfs-boundary-tooltip' }
            )
          },
        }).addTo(map)

        map.fitBounds(geoLayer.getBounds(), { padding: [4, 4] })

        // BM action markers — one circle per GSP group per category
        for (const action of gspActions) {
          const centroid = GSP_CENTROIDS[action.gspGroupId]
          if (!centroid) continue
          const style = CATEGORY_STYLE[action.category]
          const radius = Math.max(5, Math.sqrt(action.mw) * 1.5)
          L.circleMarker(
            [centroid.lat + style.latOffset, centroid.lng + style.lngOffset],
            {
              radius,
              color: style.color,
              fillColor: style.color,
              fillOpacity: 0.5,
              weight: 1.5,
              opacity: 0.85,
            }
          )
            .bindTooltip(
              `<strong>${centroid.name}</strong><br/>${style.label}<br/>${action.mw.toLocaleString()} MW`,
              { sticky: true, className: 'dfs-zone-tooltip' }
            )
            .addTo(map)
        }
      })
      .catch(() => {}) // aborted fetches throw — swallow silently

    return () => abortController.abort()
  }, [bids, gspActions])

  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  if (accepted.length === 0 || maxMW === 0) return null

  const activeCategories = [...new Set(gspActions.map((a) => a.category))]

  return (
    <div className="h-full overflow-hidden rounded border border-gray-200 flex flex-col" style={{ background: '#fff' }}>
      <div ref={containerRef} style={{ height, background: '#fff', flex: 1 }} />
      {activeCategories.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-2 py-1 border-t border-gray-100">
          {activeCategories.map((cat) => (
            <span key={cat} className="flex items-center gap-1 text-xs text-gray-500">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full border"
                style={{ background: CATEGORY_STYLE[cat].color + '80', borderColor: CATEGORY_STYLE[cat].color }}
              />
              {CATEGORY_STYLE[cat].label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
