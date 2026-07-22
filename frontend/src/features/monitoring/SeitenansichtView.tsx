import { useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import type { DrillingReading, ProfileSample } from '@hdd-planner/domain'
import { colors } from '../../theme/tokens'
import { deviationColor } from './constants'
import type { GuidanceArrows } from './guidanceArrows'

const WIDTH = 640
const HEIGHT = 200
const MARGIN = { top: 10, right: 16, bottom: 12, left: 12 }
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom
const ARROW_LENGTH_PX = 34
const STEER_STEP_DEG = 15

interface SeitenansichtViewProps {
  profile: ProfileSample[]
  readings: DrillingReading[]
  replanTriggerIndex: number | null
  guidance: GuidanceArrows | null
  manualMode?: boolean
  onSteerVertical?: (deltaDeg: number) => void
}

// The plot's X (distance) and Y (depth) axes use independent scales, so a
// real-world angle would look visually wrong drawn at face value — this
// applies the same per-axis scale ratio the plotted lines already get, then
// normalizes back to a constant on-screen length so the arrow stays
// visible regardless of how flat or steep that ends up looking.
function verticalAngleToDelta(angleDeg: number, pxPerMeterX: number, pxPerMeterY: number, lengthPx: number) {
  const rad = (angleDeg * Math.PI) / 180
  const visualSlope = Math.tan(rad) * (pxPerMeterY / pxPerMeterX)
  const visualAngleRad = Math.atan(visualSlope)
  return { dx: Math.cos(visualAngleRad) * lengthPx, dy: Math.sin(visualAngleRad) * lengthPx }
}

/** Distance × depth, same axis convention as SideViewPanel.tsx — depth here is already "meters below terrain," matching a reading's own depthM directly, no unit conversion needed. */
export function SeitenansichtView({
  profile,
  readings,
  replanTriggerIndex,
  guidance,
  manualMode,
  onSteerVertical,
}: SeitenansichtViewProps) {
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
      pxPerMeterX: PLOT_W / maxDistance,
      pxPerMeterY: PLOT_H / maxDepth,
    }
  }, [profile, readings, replanTriggerIndex])

  const latest = readings.length > 0 ? readings[readings.length - 1] : null

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!onSteerVertical) return
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      onSteerVertical(-STEER_STEP_DEG)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      onSteerVertical(STEER_STEP_DEG)
    }
  }

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1 }}>
        <Typography variant="caption" color={colors.textMuted} sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
          SEITENANSICHT
        </Typography>
        {manualMode && (
          <Typography variant="caption" color={colors.accentOrange}>
            Klicken, dann ↑/↓ zum Steuern
          </Typography>
        )}
      </Stack>
      <Box
        tabIndex={manualMode ? 0 : undefined}
        onKeyDown={manualMode ? handleKeyDown : undefined}
        sx={{
          borderRadius: 1,
          outline: 'none',
          '&:focus-visible': manualMode ? { boxShadow: `0 0 0 2px ${colors.accentOrange}` } : undefined,
        }}
      >
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT}>
        <defs>
          <marker id="sa-arrow-planned" markerWidth={5.5} markerHeight={5.5} refX={4} refY={2.75} orient="auto">
            <path d="M0,0 L5.5,2.75 L0,5.5 Z" fill={colors.textMuted} />
          </marker>
          <marker id="sa-arrow-actual" markerWidth={5.5} markerHeight={5.5} refX={4} refY={2.75} orient="auto">
            <path d="M0,0 L5.5,2.75 L0,5.5 Z" fill={colors.accentBlue} />
          </marker>
          <marker id="sa-arrow-corrective" markerWidth={5.5} markerHeight={5.5} refX={4} refY={2.75} orient="auto">
            <path d="M0,0 L5.5,2.75 L0,5.5 Z" fill={colors.accentRed} />
          </marker>
        </defs>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          <line x1={0} x2={PLOT_W} y1={0} y2={0} stroke={colors.border} strokeWidth={1} />
          <path d={layout.plannedPath} fill="none" stroke={colors.textMuted} strokeWidth={1.5} strokeDasharray="5 4" />
          <path d={layout.trailBeforePath} fill="none" stroke={colors.accentBlue} strokeWidth={2} />
          {layout.trailAfterPath && (
            <path d={layout.trailAfterPath} fill="none" stroke={colors.accentGreen} strokeWidth={2} />
          )}
          {layout.currentPoint && latest && guidance && (
            <>
              {(() => {
                const { x, y } = layout.currentPoint!
                const planned = verticalAngleToDelta(guidance.plannedVerticalAngleDeg, layout.pxPerMeterX, layout.pxPerMeterY, ARROW_LENGTH_PX)
                const actual = verticalAngleToDelta(guidance.actualVerticalAngleDeg, layout.pxPerMeterX, layout.pxPerMeterY, ARROW_LENGTH_PX)
                const corrective = verticalAngleToDelta(guidance.correctiveVerticalAngleDeg, layout.pxPerMeterX, layout.pxPerMeterY, ARROW_LENGTH_PX)
                return (
                  <>
                    <line
                      x1={x}
                      y1={y}
                      x2={x + planned.dx}
                      y2={y + planned.dy}
                      stroke={colors.textMuted}
                      strokeWidth={1.25}
                      markerEnd="url(#sa-arrow-planned)"
                    />
                    <line
                      x1={x}
                      y1={y}
                      x2={x + actual.dx}
                      y2={y + actual.dy}
                      stroke={colors.accentBlue}
                      strokeWidth={1.25}
                      markerEnd="url(#sa-arrow-actual)"
                    />
                    {guidance.showCorrectiveVertical && (
                      <line
                        x1={x}
                        y1={y}
                        x2={x + corrective.dx}
                        y2={y + corrective.dy}
                        stroke={colors.accentRed}
                        strokeWidth={1.25}
                        strokeDasharray={guidance.correctiveVerticalFeasible ? undefined : '4 3'}
                        opacity={guidance.correctiveVerticalFeasible ? 1 : 0.55}
                        markerEnd="url(#sa-arrow-corrective)"
                      />
                    )}
                  </>
                )
              })()}
            </>
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
      <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
        <ArrowLegend color={colors.textMuted} label="Geplant" />
        <ArrowLegend color={colors.accentBlue} label="Ist" />
        <ArrowLegend color={colors.accentRed} label="Korrektur" dashed={guidance ? !guidance.correctiveVerticalFeasible : false} />
      </Stack>
    </Box>
  )
}

function ArrowLegend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 14, height: 2, bgcolor: color, opacity: dashed ? 0.55 : 1 }} />
      <Typography variant="caption" color={colors.textSecondary}>
        {label}
      </Typography>
    </Stack>
  )
}
