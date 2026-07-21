import { useEffect, useMemo, useRef, useState } from 'react'
import type { GeoJSONSource } from 'maplibre-gl'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  Box,
  Checkbox,
  FormControlLabel,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined'
import CenterFocusStrongOutlinedIcon from '@mui/icons-material/CenterFocusStrongOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined'
import CropSquareOutlinedIcon from '@mui/icons-material/CropSquareOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import SatelliteAltOutlinedIcon from '@mui/icons-material/SatelliteAltOutlined'
import TerrainOutlinedIcon from '@mui/icons-material/TerrainOutlined'
import { PanelFrame } from '../../layout/PanelFrame'
import { colors, utilityColors } from '../../theme/tokens'
import { mockUtilityLayers } from '../../data/mockPlanning'
import type { UtilityLayerState } from '../../types/hdd'
import { usePlanningStore } from '../../store/planningStore'
import { useMapLibreMap } from './useMapLibreMap'
import type { BasemapId } from './mapStyles'
import { buildDrillRouteFeature, buildParcelGridFeatureCollection, buildUtilityLinesFeatureCollection, defaultUtilityTypes } from '@hdd-planner/domain'
import type { Coord } from '@hdd-planner/domain'
import type { ParcelFeatureCollection } from '../../domain/flurstuecke/shapefileImport'
import { findCrossedParcels } from '../../domain/parcelCrossing'
import { featureCollectionBounds } from '../../domain/geoBounds'
import './maplibre-dark.css'

const tools = [
  { id: 'select', icon: NearMeOutlinedIcon, label: 'Auswählen' },
  { id: 'marker', icon: PlaceOutlinedIcon, label: 'Markierung setzen' },
  { id: 'line', icon: TimelineOutlinedIcon, label: 'Wegpunkt hinzufügen' },
  { id: 'rect', icon: CropSquareOutlinedIcon, label: 'Rechteck auswählen' },
  { id: 'draw', icon: EditOutlinedIcon, label: 'Freihand zeichnen' },
  { id: 'delete', icon: DeleteOutlineOutlinedIcon, label: 'Wegpunkt löschen' },
]

const basemapIcons: Record<BasemapId, typeof MapOutlinedIcon> = {
  strasse: MapOutlinedIcon,
  satellit: SatelliteAltOutlinedIcon,
  gelaende: TerrainOutlinedIcon,
}

const legendRowSx = { m: 0, display: 'flex', minHeight: 22 }
const legendCheckboxSx = { p: 0.5 }

// Whole-country view — the fallback when there's no uploaded data and no
// points placed yet, deliberately not a tight project-looking box (a brand
// new project shouldn't look like it's already centered on some location).
const GERMANY_DEFAULT_BOUNDS: [[number, number], [number, number]] = [
  [5.87, 47.27],
  [15.04, 55.06],
]

const EMPTY_ROUTE_FEATURE = {
  type: 'Feature' as const,
  properties: {},
  geometry: { type: 'LineString' as const, coordinates: [] as [number, number][] },
}

const EMPTY_UTILITY_COLLECTION = { type: 'FeatureCollection' as const, features: [] }
const EMPTY_PARCEL_GRID_COLLECTION = { type: 'FeatureCollection' as const, features: [] }

function computeBounds(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
): [[number, number], [number, number]] {
  const padLng = Math.abs(end.lng - start.lng) * 0.6 + 0.0004
  const padLat = Math.abs(end.lat - start.lat) * 0.6 + 0.0004
  return [
    [Math.min(start.lng, end.lng) - padLng, Math.min(start.lat, end.lat) - padLat],
    [Math.max(start.lng, end.lng) + padLng, Math.max(start.lat, end.lat) + padLat],
  ]
}

// On first load, frame whatever real data exists (Spartenplan, then
// Flurstücke) instead of always opening on the mock demo location.
function getInitialBounds(): [[number, number], [number, number]] {
  const state = usePlanningStore.getState()
  const { startPoint, endPoint } = state.parameters
  return (
    featureCollectionBounds(state.uploadedSpartenplan) ??
    featureCollectionBounds(state.uploadedParcels) ??
    (startPoint && endPoint ? computeBounds(startPoint, endPoint) : GERMANY_DEFAULT_BOUNDS)
  )
}

export function MapPanel() {
  const startPoint = usePlanningStore((s) => s.parameters.startPoint)
  const endPoint = usePlanningStore((s) => s.parameters.endPoint)
  const waypoints = usePlanningStore((s) => s.parameters.waypoints)
  const pointPickMode = usePlanningStore((s) => s.pointPickMode)
  const setPoint = usePlanningStore((s) => s.setPoint)
  const addWaypoint = usePlanningStore((s) => s.addWaypoint)
  const moveWaypoint = usePlanningStore((s) => s.moveWaypoint)
  const removeWaypoint = usePlanningStore((s) => s.removeWaypoint)
  const conflicts = usePlanningStore((s) => s.conflicts)
  const uploadedSpartenplan = usePlanningStore((s) => s.uploadedSpartenplan)
  const uploadedParcels = usePlanningStore((s) => s.uploadedParcels)

  const resolved = !!startPoint && !!endPoint

  const [tool, setTool] = useState('select')
  const [hiddenTypes, setHiddenTypes] = useState<Set<UtilityLayerState['type']>>(new Set())
  const [showParcels, setShowParcels] = useState(true)
  const [showBasemap, setShowBasemap] = useState(true)
  const waypointMarkersRef = useRef<maplibregl.Marker[]>([])
  const hasFitInitialBounds = useRef(true)

  const { containerRef, map, basemap, setBasemap, styleVersion } = useMapLibreMap({
    bounds: getInitialBounds(),
  })

  const routeFeature = useMemo(
    () => (startPoint && endPoint ? buildDrillRouteFeature(startPoint, endPoint, waypoints) : EMPTY_ROUTE_FEATURE),
    [startPoint, endPoint, waypoints],
  )
  const utilityFeatureCollection = useMemo(() => {
    if (uploadedSpartenplan) return uploadedSpartenplan
    if (!startPoint || !endPoint) return EMPTY_UTILITY_COLLECTION
    return buildUtilityLinesFeatureCollection(startPoint, endPoint, defaultUtilityTypes)
  }, [startPoint, endPoint, uploadedSpartenplan])
  const parcelGridFeatureCollection = useMemo(
    () => (startPoint && endPoint ? buildParcelGridFeatureCollection(startPoint, endPoint) : EMPTY_PARCEL_GRID_COLLECTION),
    [startPoint, endPoint],
  )
  const emptyParcelFeatureCollection = useMemo<ParcelFeatureCollection>(
    () => ({ type: 'FeatureCollection', features: [] }),
    [],
  )

  // Live, not gated behind "Planung berechnen" — the whole point of parcel
  // crossing feedback is to see the effect of dragging a waypoint instantly.
  const crossedParcels = useMemo(() => {
    if (!uploadedParcels) return []
    const routeCoords = routeFeature.geometry.coordinates as Coord[]
    return findCrossedParcels(routeCoords, uploadedParcels)
  }, [routeFeature, uploadedParcels])

  const parcelsForMap = useMemo<ParcelFeatureCollection | null>(() => {
    if (!uploadedParcels) return null
    const crossedIndices = new Set(crossedParcels.map((c) => c.index))
    return {
      ...uploadedParcels,
      features: uploadedParcels.features.map((f, i) => ({
        ...f,
        properties: { ...f.properties, crossed: crossedIndices.has(i) },
      })),
    }
  }, [uploadedParcels, crossedParcels])
  const crossingFeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: conflicts.map((c) => ({
        type: 'Feature' as const,
        properties: { isConflict: c.isConflict, type: c.type },
        geometry: { type: 'Point' as const, coordinates: [c.point.lng, c.point.lat] },
      })),
    }),
    [conflicts],
  )

  // The legend only lists Sparten actually present in the effective data
  // (uploaded or demo) — derived rather than reset via effect, so a type
  // dropping out (e.g. clearing a Spartenplan) never leaves stale toggle state.
  const layers: UtilityLayerState[] = useMemo(() => {
    const presentTypes = new Set(utilityFeatureCollection.features.map((f) => f.properties.type))
    return mockUtilityLayers
      .filter((l) => presentTypes.has(l.type))
      .map((l) => ({ ...l, visible: !hiddenTypes.has(l.type) }))
  }, [utilityFeatureCollection, hiddenTypes])

  const toggleLayer = (type: UtilityLayerState['type']) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const handleLocateSpartenplan = () => {
    if (!map) return
    const bounds = featureCollectionBounds(utilityFeatureCollection)
    if (bounds) map.fitBounds(bounds, { padding: 56, duration: 800 })
  }

  // Start/Ziel markers are DOM overlays maintained by the Map instance itself
  // (unaffected by setStyle). Each is gated on its own point independently —
  // placing only Startpunkt should show just that marker, not wait for Ziel too.
  useEffect(() => {
    if (!map || !startPoint) return
    const marker = new maplibregl.Marker({ element: createMarkerPill('Start', colors.accentGreen) })
      .setLngLat([startPoint.lng, startPoint.lat])
      .addTo(map)
    return () => {
      marker.remove()
    }
  }, [map, startPoint])

  useEffect(() => {
    if (!map || !endPoint) return
    const marker = new maplibregl.Marker({ element: createMarkerPill('Ziel', colors.accentRed) })
      .setLngLat([endPoint.lng, endPoint.lat])
      .addTo(map)
    return () => {
      marker.remove()
    }
  }, [map, endPoint])

  // Re-fit the camera whenever the project's points move (but not on the
  // very first render — the map constructor already framed the initial box).
  useEffect(() => {
    if (!map || !startPoint || !endPoint) return
    if (hasFitInitialBounds.current) {
      hasFitInitialBounds.current = false
      return
    }
    map.fitBounds(computeBounds(startPoint, endPoint), { padding: 56, duration: 800 })
  }, [map, startPoint, endPoint])

  // Click-to-place: while a point-pick mode is active, the next map click
  // commits that lat/lng to the store and the mode resets itself.
  useEffect(() => {
    if (!map || !pointPickMode) return
    const canvas = map.getCanvas()
    canvas.style.cursor = 'crosshair'
    const handleClick = (e: maplibregl.MapMouseEvent) => {
      setPoint(pointPickMode, { lat: e.lngLat.lat, lng: e.lngLat.lng })
    }
    map.once('click', handleClick)
    return () => {
      map.off('click', handleClick)
      canvas.style.cursor = ''
    }
  }, [map, pointPickMode, setPoint])

  // 'line' tool: every map click adds a bend point (inserted wherever it
  // detours the route least). 'delete' tool: cursor hints that clicking a
  // waypoint marker (see the marker effect below) removes it.
  useEffect(() => {
    if (!map) return
    const canvas = map.getCanvas()
    if (tool === 'line') {
      canvas.style.cursor = 'crosshair'
      const handleClick = (e: maplibregl.MapMouseEvent) => {
        addWaypoint({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      }
      map.on('click', handleClick)
      return () => {
        map.off('click', handleClick)
        canvas.style.cursor = ''
      }
    }
    if (tool === 'delete') {
      canvas.style.cursor = 'not-allowed'
      return () => {
        canvas.style.cursor = ''
      }
    }
  }, [map, tool, addWaypoint])

  // Waypoint markers are rebuilt whenever the waypoints array or the active
  // tool changes (tool affects both styling and what a marker click does).
  useEffect(() => {
    if (!map) return
    const markers = waypoints.map((wp, index) => {
      const marker = new maplibregl.Marker({ element: createWaypointDot(tool === 'delete'), draggable: true })
        .setLngLat([wp.lng, wp.lat])
        .addTo(map)
      marker.on('dragend', () => {
        const { lng, lat } = marker.getLngLat()
        moveWaypoint(index, { lat, lng })
      })
      marker.getElement().addEventListener('click', (e) => {
        e.stopPropagation()
        if (tool === 'delete') removeWaypoint(index)
      })
      return marker
    })
    waypointMarkersRef.current = markers
    return () => {
      markers.forEach((m) => m.remove())
    }
  }, [map, waypoints, tool, moveWaypoint, removeWaypoint])

  // Data layers live in the style, so a basemap switch (setStyle) wipes them —
  // rebuild whenever the map/style/geometry changes, and keep visibility in
  // sync with the legend checkboxes on every run of this effect.
  useEffect(() => {
    if (!map) return

    if (!map.getSource('drill-route')) {
      map.addSource('drill-route', { type: 'geojson', data: routeFeature })
      map.addLayer({
        id: 'drill-route-casing',
        type: 'line',
        source: 'drill-route',
        paint: { 'line-color': colors.bgApp, 'line-width': 7, 'line-opacity': 0.55 },
      })
      map.addLayer({
        id: 'drill-route-line',
        type: 'line',
        source: 'drill-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': colors.accentOrange, 'line-width': 4 },
      })
    } else {
      ;(map.getSource('drill-route') as GeoJSONSource).setData(routeFeature)
    }

    if (!map.getSource('parcels')) {
      map.addSource('parcels', { type: 'geojson', data: parcelGridFeatureCollection })
      map.addLayer({
        id: 'parcels-layer',
        type: 'line',
        source: 'parcels',
        paint: { 'line-color': '#d4a63a', 'line-width': 1, 'line-opacity': 0.45 },
      })
    } else {
      ;(map.getSource('parcels') as GeoJSONSource).setData(parcelGridFeatureCollection)
    }
    map.setLayoutProperty('parcels-layer', 'visibility', showParcels && !uploadedParcels ? 'visible' : 'none')

    const parcelsSourceData = parcelsForMap ?? emptyParcelFeatureCollection
    if (!map.getSource('parcels-real')) {
      map.addSource('parcels-real', { type: 'geojson', data: parcelsSourceData })
      map.addLayer({
        id: 'parcels-real-fill',
        type: 'fill',
        source: 'parcels-real',
        paint: {
          'fill-color': ['case', ['get', 'crossed'], colors.accentRed, '#d4a63a'],
          'fill-opacity': ['case', ['get', 'crossed'], 0.28, 0.12],
        },
      })
      map.addLayer({
        id: 'parcels-real-outline',
        type: 'line',
        source: 'parcels-real',
        paint: {
          'line-color': ['case', ['get', 'crossed'], colors.accentRed, '#d4a63a'],
          'line-width': 1.5,
          'line-opacity': 0.8,
        },
      })
    } else {
      ;(map.getSource('parcels-real') as GeoJSONSource).setData(parcelsSourceData)
    }
    map.setLayoutProperty('parcels-real-fill', 'visibility', showParcels && parcelsForMap ? 'visible' : 'none')
    map.setLayoutProperty('parcels-real-outline', 'visibility', showParcels && parcelsForMap ? 'visible' : 'none')

    if (!map.getSource('utilities')) {
      map.addSource('utilities', { type: 'geojson', data: utilityFeatureCollection })
      mockUtilityLayers.forEach((l) => {
        map.addLayer({
          id: `utility-${l.type}`,
          type: 'line',
          source: 'utilities',
          filter: ['==', ['get', 'type'], l.type],
          paint: { 'line-color': utilityColors[l.type], 'line-width': 2, 'line-opacity': 0.9 },
        })
      })
    } else {
      ;(map.getSource('utilities') as GeoJSONSource).setData(utilityFeatureCollection)
    }
    layers.forEach((l) => {
      map.setLayoutProperty(`utility-${l.type}`, 'visibility', l.visible ? 'visible' : 'none')
    })

    if (!map.getSource('utility-crossings')) {
      map.addSource('utility-crossings', { type: 'geojson', data: crossingFeatureCollection })
      map.addLayer({
        id: 'utility-crossings-halo',
        type: 'circle',
        source: 'utility-crossings',
        paint: {
          'circle-radius': 9,
          'circle-color': ['case', ['get', 'isConflict'], colors.accentRed, colors.accentGreen],
          'circle-opacity': 0.25,
        },
      })
      map.addLayer({
        id: 'utility-crossings-dot',
        type: 'circle',
        source: 'utility-crossings',
        paint: {
          'circle-radius': 4,
          'circle-color': ['case', ['get', 'isConflict'], colors.accentRed, colors.accentGreen],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': colors.bgApp,
        },
      })
    } else {
      ;(map.getSource('utility-crossings') as GeoJSONSource).setData(crossingFeatureCollection)
    }

    if (map.getLayer('basemap')) {
      map.setPaintProperty('basemap', 'raster-opacity', showBasemap ? 1 : 0.12)
    }
  }, [
    map,
    styleVersion,
    layers,
    showParcels,
    showBasemap,
    routeFeature,
    utilityFeatureCollection,
    parcelGridFeatureCollection,
    uploadedParcels,
    parcelsForMap,
    emptyParcelFeatureCollection,
    crossingFeatureCollection,
  ])

  const pickHint =
    pointPickMode === 'start'
      ? 'Karte anklicken, um den Startpunkt zu setzen'
      : pointPickMode === 'end'
        ? 'Karte anklicken, um den Zielpunkt zu setzen'
        : null

  return (
    <PanelFrame title="Draufsicht (2D)" noPadding>
      <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Box ref={containerRef} sx={{ position: 'absolute', inset: 0 }} />

        {pickHint && (
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: colors.accentBlue,
              color: '#fff',
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              zIndex: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {pickHint}
            </Typography>
          </Box>
        )}

        {/* Floating drawing toolbar */}
        <Stack
          spacing={0.5}
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            bgcolor: colors.bgPanel,
            border: `1px solid ${colors.border}`,
            borderRadius: 1.5,
            p: 0.5,
            zIndex: 1,
          }}
        >
          {tools.map((t) => {
            const Icon = t.icon
            const active = tool === t.id
            const disabled = !resolved && (t.id === 'line' || t.id === 'delete')
            return (
              <Tooltip key={t.id} title={disabled ? 'Setze zuerst Start- und Zielpunkt' : t.label} placement="right">
                <span>
                  <IconButton
                    size="small"
                    disabled={disabled}
                    onClick={() => setTool(t.id)}
                    sx={{
                      color: active ? '#fff' : colors.textSecondary,
                      bgcolor: active ? colors.accentBlue : 'transparent',
                      '&:hover': { bgcolor: active ? colors.accentBlueHover : colors.bgElevated },
                    }}
                  >
                    <Icon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )
          })}
        </Stack>

        {uploadedParcels && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              bgcolor: colors.bgPanel,
              border: `1px solid ${crossedParcels.length > 0 ? colors.accentRed : colors.border}`,
              borderRadius: 1.5,
              px: 1.5,
              py: 1,
              minWidth: 170,
              maxWidth: 260,
              zIndex: 1,
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: crossedParcels.length > 0 ? colors.accentRed : colors.textSecondary }}
            >
              {crossedParcels.length === 0
                ? '✓ Route quert kein Flurstück'
                : `⚠ Route quert ${crossedParcels.length} Flurstück${crossedParcels.length === 1 ? '' : 'e'}`}
            </Typography>
            {crossedParcels.length > 0 && (
              <Stack sx={{ mt: 0.5 }}>
                {crossedParcels.map((c) => (
                  <Typography key={c.index} variant="caption" color={colors.textSecondary} noWrap>
                    {c.label}
                  </Typography>
                ))}
              </Stack>
            )}
          </Box>
        )}

        {/* Layer legend */}
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            bgcolor: colors.bgPanel,
            border: `1px solid ${colors.border}`,
            borderRadius: 1.5,
            px: 1.5,
            py: 1,
            minWidth: 170,
            zIndex: 1,
          }}
        >
          <ToggleButtonGroup
            size="small"
            exclusive
            value={basemap}
            onChange={(_, value: BasemapId | null) => value && setBasemap(value)}
            sx={{ mb: 1, width: '100%' }}
          >
            {(['strasse', 'satellit', 'gelaende'] as BasemapId[]).map((id) => {
              const Icon = basemapIcons[id]
              return (
                <ToggleButton key={id} value={id} sx={{ flex: 1, py: 0.5, color: colors.textSecondary }}>
                  <Icon fontSize="small" />
                </ToggleButton>
              )
            })}
          </ToggleButtonGroup>

          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <FormControlLabel
              sx={legendRowSx}
              slotProps={{ typography: { variant: 'caption' } }}
              control={
                <Checkbox
                  size="small"
                  sx={legendCheckboxSx}
                  checked={layers.every((l) => l.visible)}
                  indeterminate={layers.some((l) => l.visible) && !layers.every((l) => l.visible)}
                  onChange={(_, checked) =>
                    setHiddenTypes(checked ? new Set() : new Set(layers.map((l) => l.type)))
                  }
                />
              }
              label="Spartenplan"
            />
            {uploadedSpartenplan && (
              <Tooltip title="Zum Spartenplan springen">
                <IconButton size="small" onClick={handleLocateSpartenplan} sx={{ color: colors.textSecondary }}>
                  <CenterFocusStrongOutlinedIcon fontSize="inherit" sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
          <Stack sx={{ pl: 2 }}>
            {layers.map((l) => (
              <FormControlLabel
                key={l.type}
                sx={legendRowSx}
                slotProps={{ typography: { variant: 'caption' } }}
                control={
                  <Checkbox
                    size="small"
                    checked={l.visible}
                    onChange={() => toggleLayer(l.type)}
                    sx={{ ...legendCheckboxSx, color: utilityColors[l.type], '&.Mui-checked': { color: utilityColors[l.type] } }}
                  />
                }
                label={l.label}
              />
            ))}
          </Stack>
          <FormControlLabel
            sx={legendRowSx}
            slotProps={{ typography: { variant: 'caption' } }}
            control={<Checkbox size="small" sx={legendCheckboxSx} checked={showParcels} onChange={(_, c) => setShowParcels(c)} />}
            label="Flurstücksgrenzen"
          />
          <FormControlLabel
            sx={legendRowSx}
            slotProps={{ typography: { variant: 'caption' } }}
            control={<Checkbox size="small" sx={legendCheckboxSx} checked={showBasemap} onChange={(_, c) => setShowBasemap(c)} />}
            label="Hintergrundkarte"
          />
        </Box>
      </Box>
    </PanelFrame>
  )
}

function createMarkerPill(label: string, color: string) {
  const el = document.createElement('div')
  el.textContent = label
  Object.assign(el.style, {
    background: color,
    color: '#fff',
    fontSize: '11px',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
    fontFamily: 'inherit',
    transform: 'translateY(-8px)',
  })
  return el
}

function createWaypointDot(deletable: boolean) {
  const el = document.createElement('div')
  Object.assign(el.style, {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: deletable ? colors.accentRed : colors.accentBlue,
    border: '2px solid #fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
    cursor: deletable ? 'not-allowed' : 'grab',
  })
  return el
}
