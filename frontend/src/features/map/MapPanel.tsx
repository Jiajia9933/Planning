import { useState } from 'react'
import { Box, Checkbox, FormControlLabel, IconButton, Stack, Tooltip } from '@mui/material'
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined'
import CropSquareOutlinedIcon from '@mui/icons-material/CropSquareOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import { PanelFrame } from '../../layout/PanelFrame'
import { colors, utilityColors } from '../../theme/tokens'
import { mockUtilityLayers } from '../../data/mockPlanning'
import type { UtilityLayerState } from '../../types/hdd'

const tools = [
  { id: 'select', icon: NearMeOutlinedIcon, label: 'Auswählen' },
  { id: 'marker', icon: PlaceOutlinedIcon, label: 'Markierung setzen' },
  { id: 'line', icon: TimelineOutlinedIcon, label: 'Linie zeichnen' },
  { id: 'rect', icon: CropSquareOutlinedIcon, label: 'Rechteck auswählen' },
  { id: 'draw', icon: EditOutlinedIcon, label: 'Freihand zeichnen' },
  { id: 'delete', icon: DeleteOutlineOutlinedIcon, label: 'Löschen' },
  { id: 'layers', icon: LayersOutlinedIcon, label: 'Ebenen' },
]

// A hand-authored diagonal route in panel-relative percentage coordinates —
// stands in for a real projected geometry until Milestone 2/4 wire MapLibre.
// Kept in the lower half of the panel so it never runs under the layer
// legend docked at the top-right.
const routePoints = [
  [8, 58],
  [20, 62],
  [33, 72],
  [46, 75],
  [60, 77],
  [74, 79],
  [90, 81],
]

const legendRowSx = { m: 0, display: 'flex', minHeight: 22 }
const legendCheckboxSx = { p: 0.5 }

export function MapPanel() {
  const [tool, setTool] = useState('select')
  const [layers, setLayers] = useState<UtilityLayerState[]>(mockUtilityLayers)
  const [showParcels, setShowParcels] = useState(true)
  const [showBasemap, setShowBasemap] = useState(true)

  const toggleLayer = (type: UtilityLayerState['type']) => {
    setLayers((prev) => prev.map((l) => (l.type === type ? { ...l, visible: !l.visible } : l)))
  }

  const pathD = routePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')

  return (
    <PanelFrame title="Draufsicht (2D)" noPadding>
      <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {/* Placeholder aerial basemap — replaced by a real MapLibre canvas in Milestone 2 */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: showBasemap ? 1 : 0.15,
            transition: 'opacity 150ms ease',
            background:
              'radial-gradient(circle at 20% 20%, #26331f 0%, #1c2717 45%, #141c11 100%)',
            backgroundBlendMode: 'normal',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: showBasemap ? 0.5 : 0,
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 64px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 64px)',
          }}
        />

        {/* Parcel boundaries */}
        {showParcels && (
          <Box
            component="svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            {[12, 30, 48, 66, 84].map((x) => (
              <line key={`v${x}`} x1={x} y1={0} x2={x} y2={100} stroke="#d4a63a" strokeOpacity={0.35} strokeWidth={0.15} />
            ))}
            {[18, 40, 62, 84].map((y) => (
              <line key={`h${y}`} x1={0} y1={y} x2={100} y2={y} stroke="#d4a63a" strokeOpacity={0.35} strokeWidth={0.15} />
            ))}
          </Box>
        )}

        {/* Utility lines */}
        <Box
          component="svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {layers
            .filter((l) => l.visible)
            .map((l, idx) => (
              <line
                key={l.type}
                x1={0}
                y1={15 + idx * 11}
                x2={100}
                y2={8 + idx * 13}
                stroke={utilityColors[l.type]}
                strokeWidth={0.35}
                strokeOpacity={0.85}
              />
            ))}
        </Box>

        {/* Drill route */}
        <Box
          component="svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <path d={pathD} fill="none" stroke={colors.textPrimary} strokeOpacity={0.5} strokeDasharray="1.2 1.2" strokeWidth={0.3} />
          <path d={pathD} fill="none" stroke={colors.accentOrange} strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" />
          {routePoints.slice(1, -1).map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={0.55} fill={colors.bgApp} stroke={colors.accentOrange} strokeWidth={0.35} />
          ))}
        </Box>

        {/* Start / Ziel labels */}
        <Box
          sx={{
            position: 'absolute',
            left: `${routePoints[0][0]}%`,
            top: `${routePoints[0][1]}%`,
            transform: 'translate(-8px, -130%)',
          }}
        >
          <MarkerPill label="Start" color={colors.accentGreen} />
        </Box>
        <Box
          sx={{
            position: 'absolute',
            left: `${routePoints[routePoints.length - 1][0]}%`,
            top: `${routePoints[routePoints.length - 1][1]}%`,
            transform: 'translate(-8px, -130%)',
          }}
        >
          <MarkerPill label="Ziel" color={colors.accentRed} />
        </Box>

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
          }}
        >
          <FormControlLabel
            sx={legendRowSx}
            slotProps={{ typography: { variant: 'caption' } }}
            control={<Checkbox size="small" sx={legendCheckboxSx} checked={layers.every((l) => l.visible)} indeterminate={layers.some((l) => l.visible) && !layers.every((l) => l.visible)} onChange={(_, checked) => setLayers((prev) => prev.map((l) => ({ ...l, visible: checked })))} />}
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

        {/* Scale bar */}
        <Stack sx={{ position: 'absolute', bottom: 12, left: 12 }} spacing={0.25}>
          <Box sx={{ width: 64, height: 2, bgcolor: colors.textPrimary }} />
          <Box component="span" sx={{ fontSize: 11, color: colors.textSecondary }}>
            20 m
          </Box>
        </Stack>
      </Box>
    </PanelFrame>
  )
}

function MarkerPill({ label, color }: { label: string; color: string }) {
  return (
    <Box
      sx={{
        bgcolor: color,
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        px: 1,
        py: 0.25,
        borderRadius: 1,
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      }}
    >
      {label}
    </Box>
  )
}
