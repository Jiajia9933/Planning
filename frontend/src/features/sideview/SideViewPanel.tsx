import { useMemo, useRef, useState } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { PanelFrame } from '../../layout/PanelFrame'
import { colors, utilityColors } from '../../theme/tokens'
import { mockUtilityLayers } from '../../data/mockPlanning'
import { usePlanningStore } from '../../store/planningStore'

const WIDTH = 640
const HEIGHT = 280
const MARGIN = { top: 12, right: 16, bottom: 28, left: 40 }
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom

export function SideViewPanel() {
  const profile = usePlanningStore((s) => s.profile)
  const minRadiusM = usePlanningStore((s) => s.result.minRadiusM)
  const conflicts = usePlanningStore((s) => s.conflicts)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const { maxDistance, minHeight, maxHeight } = useMemo(() => {
    const distances = profile.map((p) => p.distanceM)
    const heights = profile.flatMap((p) => [p.terrainHeightM, p.drillPathHeightM, p.minRadiusHeightM])
    return {
      maxDistance: Math.max(...distances),
      minHeight: Math.min(...heights) - 2,
      maxHeight: Math.max(...heights) + 2,
    }
  }, [profile])

  const xScale = (d: number) => (d / maxDistance) * PLOT_W
  const yScale = (h: number) => PLOT_H - ((h - minHeight) / (maxHeight - minHeight)) * PLOT_H

  const terrainHeightAt = (distanceM: number) => {
    if (profile.length === 0) return 0
    for (let i = 0; i < profile.length - 1; i++) {
      const a = profile[i]
      const b = profile[i + 1]
      if (distanceM >= a.distanceM && distanceM <= b.distanceM) {
        const span = b.distanceM - a.distanceM
        const t = span === 0 ? 0 : (distanceM - a.distanceM) / span
        return a.terrainHeightM + (b.terrainHeightM - a.terrainHeightM) * t
      }
    }
    return profile[profile.length - 1].terrainHeightM
  }

  const buildPath = (key: 'terrainHeightM' | 'drillPathHeightM' | 'minRadiusHeightM') =>
    profile
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.distanceM).toFixed(1)} ${yScale(p[key]).toFixed(1)}`)
      .join(' ')

  const handleMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH - MARGIN.left
    const distance = (relX / PLOT_W) * maxDistance
    let closest = 0
    let closestDelta = Infinity
    profile.forEach((p, i) => {
      const delta = Math.abs(p.distanceM - distance)
      if (delta < closestDelta) {
        closestDelta = delta
        closest = i
      }
    })
    setHoverIndex(closest)
  }

  const hovered = hoverIndex !== null ? profile[hoverIndex] : null
  const yTicks = [30, 35, 40, 45, 50].filter((t) => t >= minHeight && t <= maxHeight)
  const xTicks = [0, 20, 40, 60, 80, 100, 120].filter((t) => t <= maxDistance + 5)

  return (
    <PanelFrame
      title="Seitenansicht (Längsschnitt)"
      actions={<SideViewLegend />}
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

            <path d={buildPath('minRadiusHeightM')} fill="none" stroke={colors.textPrimary} strokeOpacity={0.5} strokeDasharray="4 4" strokeWidth={1.25} />
            <path d={buildPath('terrainHeightM')} fill="none" stroke="#e2603f" strokeWidth={1.5} />
            <path d={buildPath('drillPathHeightM')} fill="none" stroke={colors.accentOrange} strokeWidth={3} strokeLinecap="round" />

            {conflicts.map((c, i) => {
              const cx = xScale(c.distanceM)
              const cy = yScale(terrainHeightAt(c.distanceM) - c.utilityDepthM)
              return (
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
              )
            })}

            {hovered && (
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
              onMouseLeave={() => setHoverIndex(null)}
            />
          </g>
        </svg>

        {hovered && (
          <Box
            sx={{
              position: 'absolute',
              left: `${(MARGIN.left + xScale(hovered.distanceM)) / WIDTH * 100}%`,
              top: '18%',
              transform: 'translate(12px, 0)',
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

function SideViewLegend() {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <LegendSwatch color="#e2603f" label="Gelände" />
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
