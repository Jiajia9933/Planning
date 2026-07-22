import { useMemo, useRef, useState } from 'react'
import { Box, Stack, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { PanelFrame } from '../../layout/PanelFrame'
import { colors, utilityColors } from '../../theme/tokens'
import { mockUtilityLayers } from '../../data/mockPlanning'
import { usePlanningStore } from '../../store/planningStore'
import type { UtilityCrossing } from '../../types/hdd'

const WIDTH = 640
const HEIGHT = 280
const MARGIN = { top: 12, right: 16, bottom: 28, left: 40 }
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom
const CONFLICT_HOVER_RADIUS_PX = 9

const utilityLabels = Object.fromEntries(mockUtilityLayers.map((l) => [l.type, l.label])) as Record<
  UtilityCrossing['type'],
  string
>

/** "Nice" round-number tick positions spanning [min, max] — unlike a fixed
 * hardcoded list, this scales with however long/deep the current route is
 * instead of silently truncating the axis when it exceeds a guessed range. */
function niceTicks(min: number, max: number, targetCount = 6): number[] {
  const span = max - min
  if (span <= 0) return [min]
  const rawStep = span / targetCount
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const residual = rawStep / magnitude
  const step = residual > 5 ? 10 * magnitude : residual > 2 ? 5 * magnitude : residual > 1 ? 2 * magnitude : magnitude
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

/** Catmull-Rom through the sample points, converted to cubic Bezier segments
 * — reads as a natural terrain/bore curve instead of a faceted polyline. */
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  const d = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d.push(`C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`)
  }
  return d.join(' ')
}

type CurveStyle = 'sinus' | 'segmented'

export function SideViewPanel() {
  const profile = usePlanningStore((s) => s.profile)
  const minRadiusM = usePlanningStore((s) => s.result.minRadiusM)
  const conflicts = usePlanningStore((s) => s.conflicts)
  const entryAngleDeg = usePlanningStore((s) => s.parameters.entryAngleDeg)
  const exitAngleDeg = usePlanningStore((s) => s.parameters.exitAngleDeg)
  const startPoint = usePlanningStore((s) => s.parameters.startPoint)
  const endPoint = usePlanningStore((s) => s.parameters.endPoint)
  const terrainSource = usePlanningStore((s) => s.terrainSource)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hoveredConflict, setHoveredConflict] = useState<UtilityCrossing | null>(null)
  const [curveStyle, setCurveStyle] = useState<CurveStyle>('sinus')
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Every hook above stays unconditional (Rules of Hooks) — the empty-state
  // placeholder is a JSX-level branch further down, not an early return.
  // `profile` is `[]` both before Start-/Zielpunkt are set and after they
  // are set but "Planung berechnen" hasn't run yet.
  const hasProfile = profile.length > 0

  // Purely a display choice — the underlying engineering result (entry/exit
  // arc + level straight, computed server-side) is unaffected either way.
  // 'sinus' redraws the same terrain/max-depth data as the older single
  // sine-curve shape some users are more used to reading at a glance.
  const displayProfile = useMemo(() => {
    if (curveStyle !== 'sinus' || profile.length === 0) return profile
    const maxDistanceM = profile[profile.length - 1].distanceM
    const currentMaxDepthM = Math.max(...profile.map((p) => p.terrainHeightM - p.drillPathHeightM))
    return profile.map((p) => {
      const t = maxDistanceM === 0 ? 0 : p.distanceM / maxDistanceM
      const depthM = Math.sin(t * Math.PI) * currentMaxDepthM
      const minRadiusDepthM = Math.sin(t * Math.PI) * (currentMaxDepthM * 0.82)
      return { ...p, drillPathHeightM: p.terrainHeightM - depthM, minRadiusHeightM: p.terrainHeightM - minRadiusDepthM }
    })
  }, [profile, curveStyle])

  const { maxDistance, minHeight, maxHeight } = useMemo(() => {
    if (displayProfile.length === 0) return { maxDistance: 0, minHeight: 0, maxHeight: 0 }
    const distances = displayProfile.map((p) => p.distanceM)
    const heights = displayProfile.flatMap((p) => [p.terrainHeightM, p.drillPathHeightM, p.minRadiusHeightM])
    return {
      maxDistance: Math.max(...distances),
      minHeight: Math.min(...heights) - 2,
      maxHeight: Math.max(...heights) + 2,
    }
  }, [displayProfile])

  const xScale = (d: number) => (d / maxDistance) * PLOT_W
  const yScale = (h: number) => PLOT_H - ((h - minHeight) / (maxHeight - minHeight)) * PLOT_H

  const terrainHeightAt = (distanceM: number) => {
    if (displayProfile.length === 0) return 0
    for (let i = 0; i < displayProfile.length - 1; i++) {
      const a = displayProfile[i]
      const b = displayProfile[i + 1]
      if (distanceM >= a.distanceM && distanceM <= b.distanceM) {
        const span = b.distanceM - a.distanceM
        const t = span === 0 ? 0 : (distanceM - a.distanceM) / span
        return a.terrainHeightM + (b.terrainHeightM - a.terrainHeightM) * t
      }
    }
    return displayProfile[displayProfile.length - 1].terrainHeightM
  }

  const buildCurve = (key: 'terrainHeightM' | 'drillPathHeightM' | 'minRadiusHeightM') =>
    buildSmoothPath(displayProfile.map((p) => ({ x: xScale(p.distanceM), y: yScale(p[key]) })))

  const conflictScreenPoints = useMemo(
    () =>
      conflicts.map((c) => ({
        conflict: c,
        cx: xScale(c.distanceM),
        cy: yScale(terrainHeightAt(c.distanceM) - c.utilityDepthM),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conflicts, maxDistance, minHeight, maxHeight],
  )

  const handleMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const scale = WIDTH / rect.width
    const relX = (e.clientX - rect.left) * scale - MARGIN.left
    const relY = (e.clientY - rect.top) * scale - MARGIN.top

    const nearConflict = conflictScreenPoints.find(
      (p) => Math.hypot(p.cx - relX, p.cy - relY) <= CONFLICT_HOVER_RADIUS_PX,
    )
    if (nearConflict) {
      setHoveredConflict(nearConflict.conflict)
      setHoverIndex(null)
      return
    }
    setHoveredConflict(null)

    const distance = (relX / PLOT_W) * maxDistance
    let closest = 0
    let closestDelta = Infinity
    displayProfile.forEach((p, i) => {
      const delta = Math.abs(p.distanceM - distance)
      if (delta < closestDelta) {
        closestDelta = delta
        closest = i
      }
    })
    setHoverIndex(closest)
  }

  const hovered = hoverIndex !== null ? displayProfile[hoverIndex] : null
  const yTicks = niceTicks(minHeight, maxHeight)
  const xTicks = niceTicks(0, maxDistance)

  const tooltipDistanceM = hoveredConflict?.distanceM ?? hovered?.distanceM ?? 0
  const tooltipLeftPct = ((MARGIN.left + xScale(tooltipDistanceM)) / WIDTH) * 100
  const tooltipFlips = tooltipLeftPct > 62

  if (!hasProfile) {
    return (
      <PanelFrame title="Seitenansicht (Längsschnitt)">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" color={colors.textSecondary}>
            {startPoint && endPoint
              ? "Klicke auf 'Planung berechnen', um das Seitenprofil zu sehen."
              : 'Setze Start- und Zielpunkt, um das Seitenprofil zu sehen.'}
          </Typography>
        </Box>
      </PanelFrame>
    )
  }

  return (
    <PanelFrame
      title="Seitenansicht (Längsschnitt)"
      actions={
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CurveStyleToggle value={curveStyle} onChange={setCurveStyle} />
          <SideViewLegend terrainSource={terrainSource} />
        </Stack>
      }
    >
      <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={0} x2={PLOT_W} y1={yScale(t)} y2={yScale(t)} stroke={colors.border} strokeWidth={1} />
                <text x={-8} y={yScale(t)} fill={colors.textSecondary} fontSize={10} textAnchor="end" dominantBaseline="middle">
                  {t}
                </text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={t} x={xScale(t)} y={PLOT_H + 18} fill={colors.textSecondary} fontSize={10} textAnchor="middle">
                {t}
              </text>
            ))}

            <path d={buildCurve('minRadiusHeightM')} fill="none" stroke={colors.textPrimary} strokeOpacity={0.5} strokeDasharray="4 4" strokeWidth={1.25} />
            <path d={buildCurve('terrainHeightM')} fill="none" stroke="#e2603f" strokeWidth={1.5} />
            <path d={buildCurve('drillPathHeightM')} fill="none" stroke={colors.accentOrange} strokeWidth={3} strokeLinecap="round" />

            {displayProfile.length > 0 && (
              <>
                <text
                  x={xScale(displayProfile[0].distanceM) + 6}
                  y={yScale(displayProfile[0].drillPathHeightM) - 8}
                  fill={colors.textSecondary}
                  fontSize={10}
                >
                  Eintritt {entryAngleDeg}°
                </text>
                <text
                  x={xScale(displayProfile[displayProfile.length - 1].distanceM) - 6}
                  y={yScale(displayProfile[displayProfile.length - 1].drillPathHeightM) - 8}
                  fill={colors.textSecondary}
                  fontSize={10}
                  textAnchor="end"
                >
                  Austritt {exitAngleDeg}°
                </text>
              </>
            )}

            {conflictScreenPoints.map(({ conflict: c, cx, cy }, i) => (
              <g key={i}>
                <line
                  x1={cx}
                  x2={cx}
                  y1={yScale(terrainHeightAt(c.distanceM))}
                  y2={cy}
                  stroke={utilityColors[c.type]}
                  strokeOpacity={0.5}
                  strokeWidth={1}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={c.isConflict ? 5 : 3.5}
                  fill={c.isConflict ? colors.accentRed : utilityColors[c.type]}
                  stroke={colors.bgApp}
                  strokeWidth={1.25}
                />
              </g>
            ))}

            {hovered && !hoveredConflict && (
              <>
                <line
                  x1={xScale(hovered.distanceM)}
                  x2={xScale(hovered.distanceM)}
                  y1={0}
                  y2={PLOT_H}
                  stroke={colors.textMuted}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
                <circle cx={xScale(hovered.distanceM)} cy={yScale(hovered.drillPathHeightM)} r={4} fill={colors.accentOrange} stroke={colors.bgApp} strokeWidth={1.5} />
              </>
            )}

            <rect
              x={0}
              y={0}
              width={PLOT_W}
              height={PLOT_H}
              fill="transparent"
              onMouseMove={handleMove}
              onMouseLeave={() => {
                setHoverIndex(null)
                setHoveredConflict(null)
              }}
            />
          </g>
        </svg>

        {hoveredConflict && (
          <Box
            sx={{
              position: 'absolute',
              left: `${tooltipLeftPct}%`,
              top: '18%',
              transform: tooltipFlips ? 'translate(calc(-100% - 12px), 0)' : 'translate(12px, 0)',
              bgcolor: colors.bgElevated,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: 1,
              px: 1.25,
              py: 0.75,
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              minWidth: 160,
            }}
          >
            <Typography
              variant="caption"
              sx={{ display: 'block', fontWeight: 700 }}
              color={hoveredConflict.isConflict ? colors.accentRed : colors.textPrimary}
            >
              {hoveredConflict.isConflict ? '⚠ Konflikt: ' : 'Kreuzung: '}
              {utilityLabels[hoveredConflict.type]}
            </Typography>
            <Typography variant="caption" color={colors.textSecondary} sx={{ display: 'block' }}>
              Distanz: {hoveredConflict.distanceM.toFixed(2)} m
            </Typography>
            <Typography variant="caption" color={colors.textSecondary} sx={{ display: 'block' }}>
              Bohrtiefe: {hoveredConflict.drillDepthM.toFixed(2)} m · Leitung: {hoveredConflict.utilityDepthM.toFixed(2)} m
            </Typography>
            <Typography variant="caption" color={colors.textSecondary} sx={{ display: 'block' }}>
              Abstand: {hoveredConflict.clearanceM.toFixed(2)} m
            </Typography>
          </Box>
        )}

        {hovered && !hoveredConflict && (
          <Box
            sx={{
              position: 'absolute',
              left: `${tooltipLeftPct}%`,
              top: '18%',
              transform: tooltipFlips ? 'translate(calc(-100% - 12px), 0)' : 'translate(12px, 0)',
              bgcolor: colors.bgElevated,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: 1,
              px: 1.25,
              py: 0.75,
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}
          >
            <Typography variant="caption" color={colors.textSecondary} sx={{ display: 'block' }}>
              Distanz: {hovered.distanceM.toFixed(2)} m
            </Typography>
            <Typography variant="caption" color={colors.textSecondary} sx={{ display: 'block' }}>
              Tiefe: {Math.abs(hovered.terrainHeightM - hovered.drillPathHeightM).toFixed(2)} m
            </Typography>
            <Typography variant="caption" color={colors.textSecondary} sx={{ display: 'block' }}>
              Radius: {minRadiusM.toFixed(2)} m
            </Typography>
          </Box>
        )}
      </Box>
    </PanelFrame>
  )
}

function CurveStyleToggle({ value, onChange }: { value: CurveStyle; onChange: (value: CurveStyle) => void }) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value}
      onChange={(_, next: CurveStyle | null) => next && onChange(next)}
    >
      <ToggleButton value="sinus" sx={{ px: 1, py: 0.25, fontSize: 11, color: colors.textSecondary }}>
        Sinus
      </ToggleButton>
      <ToggleButton value="segmented" sx={{ px: 1, py: 0.25, fontSize: 11, color: colors.textSecondary }}>
        3-Segment
      </ToggleButton>
    </ToggleButtonGroup>
  )
}

function SideViewLegend({ terrainSource }: { terrainSource: 'real' | 'synthetic' }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <LegendSwatch
        color="#e2603f"
        label={terrainSource === 'real' ? 'Gelände (reale Höhendaten)' : 'Gelände (vereinfacht)'}
      />
      <LegendSwatch color={colors.accentOrange} label="Bohrpfad" thick />
      <LegendSwatch color={colors.textPrimary} label="Min. Radius" dashed />
      {mockUtilityLayers.map((l) => (
        <LegendSwatch key={l.type} color={utilityColors[l.type]} label={l.label} />
      ))}
    </Stack>
  )
}

function LegendSwatch({
  color,
  label,
  thick,
  dashed,
}: {
  color: string
  label: string
  thick?: boolean
  dashed?: boolean
}) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Box
        sx={{
          width: 14,
          height: thick ? 3 : 2,
          bgcolor: dashed ? 'transparent' : color,
          borderTop: dashed ? `2px dashed ${color}` : 'none',
        }}
      />
      <Typography variant="caption" color={colors.textSecondary}>
        {label}
      </Typography>
    </Stack>
  )
}
