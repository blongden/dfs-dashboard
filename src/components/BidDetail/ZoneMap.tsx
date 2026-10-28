import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { NormalisedBid, ZoneNumber } from '../../types/dfs'
import type { GspAction } from '../../api/balancing'
import type { ConstraintFlow } from '../../api/constraints'
import { INTERCONNECTORS } from '../../api/interconnectors'
import type { InterconnectorFlow } from '../../api/interconnectors'
import { GSP_CENTROIDS } from '../../data/gspGroups'

interface Props {
  bids: NormalisedBid[]
  gspActions?: GspAction[]
  constraintFlows?: ConstraintFlow[]
  interconnectorFlows?: InterconnectorFlow[]
  announcedZones?: Partial<Record<ZoneNumber, number>>
  announcedEventType?: string
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

function interpolateOfferedColor(t: number): string {
  // 0 = light grey, 1 = slate — offered volume where nothing was accepted
  const r = Math.round(226 - t * 131)
  const g = Math.round(232 - t * 123)
  const b = Math.round(240 - t * 103)
  return `rgb(${r},${g},${b})`
}

function interpolateAnnouncedColor(t: number, eventType: string): string {
  if (eventType === 'Upwards') {
    // light → mid blue
    const r = Math.round(219 - t * 150)
    const g = Math.round(234 - t * 122)
    const b = Math.round(254 - t * 56)
    return `rgb(${r},${g},${b})`
  }
  // Downwards → amber
  const r = Math.round(254 - t * 8)
  const g = Math.round(243 - t * 130)
  const b = Math.round(199 - t * 166)
  return `rgb(${r},${g},${b})`
}

// Map boundary line (GeoJSON label) → NESO day-ahead constraint group.
// Only boundaries whose group is confirmed are listed; others keep their static style.
const BOUNDARY_GROUP: Record<string, string> = {
  B6: 'SCOTEX',
  B7: 'SSHARN3',
  B9: 'FLOWSTH',
}

const NO_FLOWS: ConstraintFlow[] = []
const NO_ACTIONS: GspAction[] = []
const NO_IC_FLOWS: InterconnectorFlow[] = []

const IC_IMPORT = '#0d9488'
const IC_EXPORT = '#ea580c'
const IC_IDLE_MW = 25 // below this a link is treated as idle: no arrow

function heatColor(ratio: number): string {
  if (ratio >= 1.0) return '#dc2626'  // red — over limit
  if (ratio >= 0.85) return '#d97706' // amber — near limit
  return '#16a34a'                    // green — clear
}

function arrowMarker(at: L.LatLngExpression, angle: number, color: string, size = 14): L.Marker {
  return L.marker(at, {
    interactive: false,
    icon: L.divIcon({
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<svg width="${size}" height="${size}" viewBox="0 0 14 14" style="transform:rotate(${angle}deg)"><path d="M7 1 L12 12 L7 9 L2 12 Z" fill="${color}" stroke="#fff" stroke-width="1"/></svg>`,
    }),
  })
}

const CATEGORY_STYLE: Record<GspAction['category'], { color: string; label: string; latOffset: number; lngOffset: number }> = {
  'wind':          { color: '#f59e0b', label: 'Wind curtailed',       latOffset:  0.15, lngOffset:  0    },
  'pumped-storage':{ color: '#3b82f6', label: 'Pumped storage chg',   latOffset: -0.15, lngOffset:  0.2  },
  'battery':       { color: '#22c55e', label: 'Batteries charging',   latOffset: -0.15, lngOffset: -0.2  },
}

type Geo = { zones: GeoJSON.GeoJsonObject; boundaries: GeoJSON.GeoJsonObject }

// Fetched once per page load and shared by every map instance
let geoCache: Promise<Geo> | null = null
function loadGeo(): Promise<Geo> {
  if (!geoCache) {
    const get = (name: string) => fetch(`${import.meta.env.BASE_URL}${name}`).then((r) => r.json())
    geoCache = Promise.all([get('dfs-zones.geojson'), get('etys-boundaries.geojson')])
      .then(([zones, boundaries]) => ({ zones, boundaries }))
      .catch((err) => { geoCache = null; throw err })
  }
  return geoCache
}

// Geometry helpers work in projected space at a fixed zoom, so arrow angles and positions
// don't depend on the map's current view (conformal projection preserves angles)
const PROJ_ZOOM = 8
const toPoint = (ll: L.LatLngExpression) => L.CRS.EPSG3857.latLngToPoint(L.latLng(ll), PROJ_ZOOM)
const toLatLng = (p: L.Point) => L.CRS.EPSG3857.pointToLatLng(p, PROJ_ZOOM)

interface Layers {
  zones: L.LayerGroup
  boundaries: L.LayerGroup
  interconnectors: L.LayerGroup
  balancing: L.LayerGroup
}

export function ZoneMap({ bids, gspActions = NO_ACTIONS, constraintFlows = NO_FLOWS, interconnectorFlows = NO_IC_FLOWS, announcedZones, announcedEventType, height = '100%' }: Props) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const layersRef = useRef<Layers | null>(null)
  const boundsRef = useRef<L.LatLngBounds | null>(null)
  const [map, setMap] = useState<L.Map | null>(null)
  const [geo, setGeo] = useState<Geo | null>(null)

  const accepted = useMemo(() => bids.filter((b) => b.status === 'Accepted'), [bids])
  // When nothing was accepted, show where volume was offered instead
  const offeredMode = accepted.length === 0 && bids.length > 0
  const heatBids = offeredMode ? bids : accepted

  // Aggregate MW per zone (accepted, or offered in offeredMode)
  const zoneMW = useMemo(() => {
    const totals = new Map<number, number>()
    for (const bid of heatBids) {
      if (bid.zoneData.type === 'numbered' && bid.zoneData.zone !== undefined) {
        const z = bid.zoneData.zone
        totals.set(z, (totals.get(z) ?? 0) + bid.volumeMW)
      }
    }
    return totals
  }, [heatBids])

  const maxMW = Math.max(0, ...zoneMW.values())

  useEffect(() => {
    let cancelled = false
    loadGeo().then((g) => { if (!cancelled) setGeo(g) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Create the map (and its layer groups) when the container appears, destroy it when it goes
  useEffect(() => {
    if (!container) return

    const created = L.map(container, {
      zoomControl: false,
      zoomSnap: 0, // fit the map to the box rather than snapping to a whole zoom level
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    })
    layersRef.current = {
      zones: L.layerGroup().addTo(created),
      boundaries: L.layerGroup().addTo(created),
      interconnectors: L.layerGroup().addTo(created),
      balancing: L.layerGroup().addTo(created),
    }
    boundsRef.current = null
    setMap(created)

    return () => {
      created.remove()
      layersRef.current = null
      setMap(null)
    }
  }, [container])

  // Zones — redrawn only when the zone data changes
  useEffect(() => {
    const layers = layersRef.current
    if (!map || !geo || !layers) return
    layers.zones.clearLayers()

    const announcedMaxMW = announcedZones
      ? Math.max(0, ...Object.values(announcedZones).filter((v): v is number => v != null))
      : 0

    const geoLayer = L.geoJSON(geo.zones, {
      style: (feature) => {
        const zone = feature?.properties?.Region as number
        if (announcedZones && announcedEventType) {
          const cap = announcedZones[zone as ZoneNumber]
          const t = cap != null && announcedMaxMW > 0 ? cap / announcedMaxMW : 0
          return {
            fillColor: cap != null ? interpolateAnnouncedColor(Math.max(0.25, t), announcedEventType) : '#f1f5f9',
            fillOpacity: cap != null ? 0.75 : 0.3,
            color: '#94a3b8',
            weight: 1,
          }
        }
        const mw = zoneMW.get(zone) ?? 0
        const t = maxMW > 0 ? mw / maxMW : 0
        return {
          fillColor: t > 0 ? (offeredMode ? interpolateOfferedColor(t) : interpolateColor(t)) : '#f1f5f9',
          fillOpacity: t > 0 ? 0.85 : 0.4,
          color: '#94a3b8',
          weight: 1,
        }
      },
      onEachFeature: (feature, layer) => {
        const zone = feature.properties?.Region as ZoneNumber
        const label = ZONE_LABELS[zone] ?? `Zone ${zone}`
        if (announcedZones && announcedEventType) {
          const cap = announcedZones[zone]
          layer.bindTooltip(
            `<strong>Zone ${zone}</strong><br/>${label}${cap != null ? `<br/>Cap: ${cap.toLocaleString()} MW` : '<br/>No cap set'}`,
            { sticky: true, className: 'dfs-zone-tooltip' }
          )
        } else {
          const mw = zoneMW.get(zone) ?? 0
          layer.bindTooltip(
            `<strong>Zone ${zone}</strong><br/>${label}${mw > 0 ? `<br/>${mw.toFixed(1)} MW ${offeredMode ? 'offered, none accepted' : 'accepted'}` : `<br/>${offeredMode ? 'No bids offered' : 'No accepted bids'}`}`,
            { sticky: true, className: 'dfs-zone-tooltip' }
          )
        }
      },
    }).addTo(layers.zones)

    // Fit once, including every interconnector's sea end so the view never changes as flow data arrives
    const bounds = geoLayer.getBounds()
    for (const ic of INTERCONNECTORS) bounds.extend(ic.sea)
    boundsRef.current = bounds
    map.invalidateSize()
    map.fitBounds(bounds, { padding: [6, 6], animate: false })
  }, [map, geo, zoneMW, maxMW, offeredMode, announcedZones, announcedEventType])

  // Refit when the box resizes (legends appear below the map as data loads)
  useEffect(() => {
    if (!map || !container) return
    const observer = new ResizeObserver(() => {
      map.invalidateSize()
      if (boundsRef.current) map.fitBounds(boundsRef.current, { padding: [6, 6], animate: false })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [map, container])

  // Boundary load heat + direction of travel
  useEffect(() => {
    const layers = layersRef.current
    if (!map || !geo || !layers) return
    layers.boundaries.clearLayers()

    const flowByGroup = new Map(constraintFlows.map((f) => [f.group, f]))
    const flowFor = (label?: string) => {
      const group = label && BOUNDARY_GROUP[label.split(' ')[0]]
      return group ? flowByGroup.get(group) : undefined
    }

    const boundaryLayer = L.geoJSON(geo.boundaries, {
      style: (feature) => {
        const flow = flowFor(feature?.properties?.label)
        if (!flow) {
          return {
            color: feature?.properties?.color ?? '#6b7280',
            weight: 2,
            dashArray: '6 4',
            fillOpacity: 0,
            opacity: 0.85,
          }
        }
        const ratio = flow.flowMW / flow.limitMW
        return {
          color: heatColor(ratio),
          weight: ratio >= 0.85 ? 5 : 3.5,
          dashArray: ratio >= 1 ? undefined : '6 4',
          fillOpacity: 0,
          opacity: 1,
        }
      },
      onEachFeature: (feature, layer) => {
        const { label, desc } = feature?.properties ?? {}
        if (!label) return
        const flow = flowFor(label)
        let live = ''
        if (flow) {
          const ratio = flow.flowMW / flow.limitMW
          const headroom = flow.limitMW - flow.flowMW
          const southbound = flow.flowMW >= 0
          live = `<br/><span style="color:${heatColor(ratio)};font-weight:600">${southbound ? `${Math.round(ratio * 100)}% of limit` : 'Reverse flow'}</span>` +
            `<br/>${southbound ? 'Flowing south' : 'Flowing north'}` +
            `<br/>${Math.round(Math.abs(flow.flowMW)).toLocaleString()} ${southbound ? `/ ${Math.round(flow.limitMW).toLocaleString()} ` : ''}MW` +
            `<br/>${headroom >= 0 ? `${Math.round(headroom).toLocaleString()} MW headroom` : `${Math.round(-headroom).toLocaleString()} MW over limit`}`
        }
        layer.bindTooltip(
          `<div style="max-width:160px;white-space:normal"><strong>${label}</strong>${live}<br/>${desc}</div>`,
          { sticky: true, className: 'dfs-boundary-tooltip' }
        )
      },
    }).addTo(layers.boundaries)

    // Direction of travel — positive flow runs north → south (NESO diagram convention)
    boundaryLayer.eachLayer((layer) => {
      const feature = (layer as L.GeoJSON).feature as GeoJSON.Feature | undefined
      const flow = flowFor(feature?.properties?.label)
      if (!flow || !(layer instanceof L.Polyline)) return
      const pts = (layer.getLatLngs() as L.LatLng[]).map(toPoint)
      const cum = [0]
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
      const total = cum[cum.length - 1]
      if (total === 0) return
      const southbound = flow.flowMW >= 0
      const color = heatColor(flow.flowMW / flow.limitMW)
      for (const frac of [0.2, 0.5, 0.8]) {
        const target = total * frac
        let i = 1
        while (i < pts.length - 1 && cum[i] < target) i++
        const p0 = pts[i - 1]
        const p1 = pts[i]
        const t = cum[i] === cum[i - 1] ? 0 : (target - cum[i - 1]) / (cum[i] - cum[i - 1])
        const at = toLatLng(L.point(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t))
        // normal to the line, oriented down the screen (south) then flipped for reverse flow
        let nx = p1.y - p0.y
        let ny = -(p1.x - p0.x)
        if (ny < 0) { nx = -nx; ny = -ny }
        if (!southbound) { nx = -nx; ny = -ny }
        arrowMarker(at, (Math.atan2(nx, -ny) * 180) / Math.PI, color, 16).addTo(layers.boundaries)
      }
    })
  }, [map, geo, constraintFlows])

  // Interconnectors — line from the GB landing point out to sea, arrow shows direction of travel
  useEffect(() => {
    const layers = layersRef.current
    if (!map || !layers) return
    layers.interconnectors.clearLayers()

    for (const ic of INTERCONNECTORS) {
      const flow = interconnectorFlows.find((f) => f.fuelType === ic.fuelType)
      if (!flow) continue
      const mw = flow.mw
      const idle = Math.abs(mw) < IC_IDLE_MW
      const importing = mw > 0
      const color = idle ? '#9ca3af' : importing ? IC_IMPORT : IC_EXPORT
      L.polyline([ic.land, ic.sea], {
        color,
        weight: idle ? 1.5 : Math.min(2 + Math.abs(mw) / 400, 6),
        opacity: idle ? 0.7 : 0.9,
        dashArray: idle ? '3 3' : undefined,
      })
        .bindTooltip(
          `<strong>${ic.name}</strong> (${ic.to})<br/>` +
          (idle
            ? 'Idle'
            : `<span style="color:${color};font-weight:600">${importing ? 'Importing' : 'Exporting'} ${Math.round(Math.abs(mw)).toLocaleString()} MW</span>`),
          { sticky: true, className: 'dfs-zone-tooltip' }
        )
        .addTo(layers.interconnectors)

      if (idle) continue
      // Arrow sits at the mid-point; points toward GB when importing, away when exporting
      const [from, to] = importing ? [ic.sea, ic.land] : [ic.land, ic.sea]
      const a = toPoint(from)
      const b = toPoint(to)
      const angle = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI
      const mid: [number, number] = [(ic.land[0] + ic.sea[0]) / 2, (ic.land[1] + ic.sea[1]) / 2]
      arrowMarker(mid, angle, color).addTo(layers.interconnectors)
    }
  }, [map, interconnectorFlows])

  // BM action markers — one circle per GSP group per category
  useEffect(() => {
    const layers = layersRef.current
    if (!map || !layers) return
    layers.balancing.clearLayers()

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
        .addTo(layers.balancing)
    }
  }, [map, gspActions])

  const hasAnnouncedData = announcedZones && Object.keys(announcedZones).length > 0
  if (!hasAnnouncedData && (heatBids.length === 0 || maxMW === 0)) return null

  const activeCategories = [...new Set(gspActions.map((a) => a.category))]

  return (
    <div className="h-full overflow-hidden rounded border border-gray-200 flex flex-col" style={{ background: '#fff' }}>
      <div ref={setContainer} style={{ height, background: '#fff', flex: 1 }} />
      {offeredMode && !hasAnnouncedData && (
        <div className="px-2 py-1 border-t border-gray-100 text-xs text-gray-500">
          Shaded by MW <strong>offered</strong> — no bids were accepted
        </div>
      )}
      {constraintFlows.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-2 py-1 border-t border-gray-100">
          <span className="text-xs text-gray-500">Boundary load (arrows = flow direction):</span>
          {([['#16a34a', '<85%'], ['#d97706', '85–100%'], ['#dc2626', 'over limit']] as const).map(([c, l]) => (
            <span key={l} className="flex items-center gap-1 text-xs text-gray-500">
              <span className="inline-block h-0.5 w-3" style={{ background: c, height: 3 }} />
              {l}
            </span>
          ))}
        </div>
      )}
      {interconnectorFlows.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-2 py-1 border-t border-gray-100">
          <span className="text-xs text-gray-500">Interconnectors:</span>
          {([[IC_IMPORT, 'Importing'], [IC_EXPORT, 'Exporting']] as const).map(([c, l]) => (
            <span key={l} className="flex items-center gap-1 text-xs text-gray-500">
              <span className="inline-block w-3" style={{ background: c, height: 3 }} />
              {l}
            </span>
          ))}
        </div>
      )}
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
