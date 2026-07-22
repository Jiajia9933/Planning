import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import type { DrillingReading, ProfileSample } from '@hdd-planner/domain'
import { colors } from '../../theme/tokens'
import { deviationColor } from './constants'

const WIDTH = 640
const HEIGHT = 200
const MARGIN = { top: 10, right: 16, bottom: 12, left: 12 }
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom

interface SeitenansichtViewProps {
  profile: ProfileSample[]
  readings: DrillingReading[]
  replanTriggerIndex: number | null
}

/** Distance × depth, same axis convention as SideViewPanel.tsx — depth here is already "meters below terrain," matching a reading's own depthM directly, no unit conversion needed. */
export function SeitenansichtView({ profile, readings, replanTriggerIndex }: SeitenansichtViewProps) {
  const layout = useMemo(() => {
    const plannedDepths = profile.map((p) => ({ distanceM: p.distanceM, depthM: p.terrainHeightM - p.drillPathHeightM }))
    const trailPoints = readings.map((r) => ({ distanceM: r.distanceM, depthM: r.depthM }))
    const maxDistance = Math.max(1, ...plannedDepths.map((p) => p.distanceM), ...trailPoints.map((p) => p.distanceM))
    const maxDepth = Math.max(1, ...plannedDepths.map((p) => p.depthM), ...trailPoints.map((p) => p.depthM))

    const xScale = (distanceM: number) => (distanceM / maxDistance) * PLOT_W
    const yScale = (depthM: number) => (depthM / maxDepth) * PLOT_H

    const buildPath = (points: { distanceM: number; depthM: number }[]) =>
      points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.distanceM).toFixed(1)} ${yScale(p.depthM).toFixed(1)}`).join(' ')

    const splitAt = replanTriggerIndex ?? trailPoints.length
    const trailBefore = trailPoints.slice(0, splitAt + 1)
    const trailAfter = trailPoints.slice(splitAt)
    const current = trailPoints.length > 0 ? trailPoints[trailPoints.length - 1] : null

    return {
      plannedPath: buildPath(plannedDepths),
      trailBeforePath: buildPath(trailBefore),
      trailAfterPath: trailAfter.length > 1 ? buildPath(trailAfter) : null,
      currentPoint: current ? { x: xScale(current.distanceM), y: yScale(current.depthM) } : null,
    }
  }, [profile, readings, replanTriggerIndex])

  const latest = readings.length > 0 ? readings[readings.length - 1] : null

  return (
    <Box>
      <Typography variant="caption" color={colors.textMuted} sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
        SEITENANSICHT
      </Typography>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          <line x1={0} x2={PLOT_W} y1={0} y2={0} stroke={colors.border} strokeWidth={1} />
          <path d={layout.plannedPath} fill="none" stroke={colors.textMuted} strokeWidth={1.5} strokeDasharray="5 4" />
          <path d={layout.trailBeforePath} fill="none" stroke={colors.accentBlue} strokeWidth={2} />
          {layout.trailAfterPath && (
            <path d={layout.trailAfterPath} fill="none" stroke={colors.accentGreen} strokeWidth={2} />
          )}
          {layout.currentPoint && latest && (
            <circle
              cx={layout.currentPoint.x}
              cy={layout.currentPoint.y}
              r={5}
              fill={deviationColor(Math.abs(latest.verticalDeviationM))}
              stroke={colors.bgApp}
              strokeWidth={2}
            />
          )}
        </g>
      </svg>
    </Box>
  )
}
