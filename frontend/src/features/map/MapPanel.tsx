import { useEffect, useRef, useState } from 'react'
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
} from '@mui/material'
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined'
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
import { mockPlanningParameters, mockUtilityLayers } from '../../data/mockPlanning'
import type { UtilityLayerState } from '../../types/hdd'
import { useMapLibreMap } from './useMapLibreMap'
import type { BasemapId } from './mapStyles'
import {
  buildDrillRouteFeature,
  buildParcelGridFeatureCollection,
  buildUtilityLinesFeatureCollection,
} from './mockGeometry'
import './maplibre-dark.css'

const tools = [
  { id: 'select', icon: NearMeOutlinedIcon, label: 'Auswählen' },
  { id: 'marker', icon: PlaceOutlinedIcon, label: 'Markierung setzen' },
  { id: 'line', icon: TimelineOutlinedIcon, label: 'Linie zeichnen' },
  { id: 'rect', icon: CropSquareOutlinedIcon, label: 'Rechteck auswählen' },
  { id: 'draw', icon: EditOutlinedIcon, label: 'Freihand zeichnen' },
  { id: 'delete', icon: DeleteOutlineOutlinedIcon, label: 'Löschen' },
]

const basemapIcons: Record<BasemapId, typeof MapOutlinedIcon> = {
  strasse: MapOutlinedIcon,
  satellit: SatelliteAltOutlinedIcon,
  gelaende: TerrainOutlinedIcon,
}

const legendRowSx = { m: 0, display: 'flex', minHeight: 22 }
const legendCheckboxSx = { p: 0.5 }

const { startPoint, endPoint } = mockPlanningParameters
const routeFeature = buildDrillRouteFeature(startPoint, endPoint)
const utilityFeatureCollection = buildUtilityLinesFeatureCollection(
  startPoint,
  endPoint,
  mockUtilityLayers.map((l) => l.type),
)
const parcelFeatureCollection = buildParcelGridFeatureCollection(startPoint, endPoint)

const padLng = Math.abs(endPoint.lng - startPoint.lng) * 0.6 + 0.0004
const padLat = Math.abs(endPoint.lat - startPoint.lat) * 0.6 + 0.0004
const routeBounds: [[number, number], [number, number]] = [
  [Math.min(startPoint.lng, endPoint.lng) - padLng, Math.min(startPoint.lat, endPoint.lat) - padLat],
  [Math.max(startPoint.lng, endPoint.lng) + padLng, Math.max(startPoint.lat, endPoint.lat) + padLat],
]

export function MapPanel() {
  const [tool, setTool] = useState('select')
  const [layers, setLayers] = useState<UtilityLayerState[]>(mockUtilityLayers)
  const [showParcels, setShowParcels] = useState(true)
  const [showBasemap, setShowBasemap] = useState(true)
  const markersRef = useRef<maplibregl.Marker[]>([])

  const { containerRef, map, basemap, setBasemap, styleVersion } = useMapLibreMap({
    bounds: routeBounds,
  })

  const toggleLayer = (type: UtilityLayerState['type']) => {
    setLayers((prev) => prev.map((l) => (l.type === type ? { ...l, visible: !l.visible } : l)))
  }

  // Start/Ziel markers are DOM overlays maintained by the Map instance itself
  // (unaffected by setStyle), so they only need to be created once.
  useEffect(() => {
    if (!map) return
    const startMarker = new maplibregl.Marker({ element: createMarkerPill('Start', colors.accentGreen) })
      .setLngLat([startPoint.lng, startPoint.lat])
      .addTo(map)
    const endMarker = new maplibregl.Marker({ element: createMarkerPill('Ziel', colors.accentRed) })
      .setLngLat([endPoint.lng, endPoint.lat])
      .addTo(map)
    markersRef.current = [startMarker, endMarker]
    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }
  }, [map])

  // Data layers live in the style, so a basemap switch (setStyle) wipes them —
  // rebuild whenever the map/style changes, and keep visibility in sync with
  // the legend checkboxes on every render of this effect.
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
      map.addSource('parcels', { type: 'geojson', data: parcelFeatureCollection })
      map.addLayer({
        id: 'parcels-layer',
        type: 'line',
        source: 'parcels',
        paint: { 'line-color': '#d4a63a', 'line-width': 1, 'line-opacity': 0.45 },
      })
    }
    map.setLayoutProperty('parcels-layer', 'visibility', showParcels ? 'visible' : 'none')

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
    }
    layers.forEach((l) => {
      map.setLayoutProperty(`utility-${l.type}`, 'visibility', l.visible ? 'visible' : 'none')
    })

    if (map.getLayer('basemap')) {
      map.setPaintProperty('basemap', 'raster-opacity', showBasemap ? 1 : 0.12)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleVersion, layers, showParcels, showBasemap])

  return (
    <PanelFrame title="Draufsicht (2D)" noPadding>
      <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Box ref={containerRef} sx={{ position: 'absolute', inset: 0 }} />

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
            return (
              <Tooltip key={t.id} title={t.label} placement="right">
                <IconButton
                  size="small"
                  onClick={() => setTool(t.id)}
                  sx={{
                    color: active ? '#fff' : colors.textSecondary,
                    bgcolor: active ? colors.accentBlue : 'transparent',
                    '&:hover': { bgcolor: active ? colors.accentBlueHover : colors.bgElevated },
                  }}
                >
                  <Icon fontSize="small" />
                </IconButton>
              </Tooltip>
            )
          })}
        </Stack>

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

          <FormControlLabel
            sx={legendRowSx}
            slotProps={{ typography: { variant: 'caption' } }}
            control={
              <Checkbox
                size="small"
                sx={legendCheckboxSx}
                checked={layers.every((l) => l.visible)}
                indeterminate={layers.some((l) => l.visible) && !layers.every((l) => l.visible)}
                onChange={(_, checked) => setLayers((prev) => prev.map((l) => ({ ...l, visible: checked })))}
              />
            }
            label="Spartenplan"
          />
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
