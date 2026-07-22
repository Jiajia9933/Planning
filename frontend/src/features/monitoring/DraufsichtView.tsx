import { useMemo } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { buildRoutePoints } from '@hdd-planner/domain'
import type { DrillingReading, GeoPoint } from '@hdd-planner/domain'
import { colors } from '../../theme/tokens'
import { deviationColor } from './constants'
import type { GuidanceArrows } from './guidanceArrows'

const WIDTH = 640
const HEIGHT = 260
const MARGIN = 24
const METERS_PER_DEGREE = 111_320
const ARROW_LENGTH_PX = 38

interface DraufsichtViewProps {
  startPoint: GeoPoint
  endPoint: GeoPoint
  waypoints: GeoPoint[]
  readings: DrillingReading[]
  replanTriggerIndex: number | null
  guidance: GuidanceArrows | null
}

/** North (increasing lat) is up in this view — see toLocalMeters/project. */
function headingToDelta(headingDeg: number, lengthPx: number): { dx: number; dy: number } {
  const rad = (headingDeg * Math.PI) / 180
  return { dx: Math.sin(rad) * lengthPx, dy: -Math.cos(rad) * lengthPx }
}

function toLocalMeters(point: GeoPoint, origin: GeoPoint): { x: number; y: number } {
  return {
    x: (point.lng - origin.lng) * METERS_PER_DEGREE * Math.cos((origin.lat * Math.PI) / 180),
    y: (point.lat - origin.lat) * METERS_PER_DEGREE,
  }
}

/** Plan-view (bird's-eye) of the planned route vs. the actual simulated trail — local-planar projection, same simplification used throughout this codebase (lineIntersection.ts, routeOptimizer.ts), not a real map. */
export function DraufsichtView({ startPoint, endPoint, waypoints, readings, replanTriggerIndex, guidance }: DraufsichtViewProps) {
  const layout = useMemo(() => {
    const origin = startPoint
    const plannedPoints = buildRoutePoints(startPoint, endPoint, waypoints)
    const trailPoints = readings.map((r) => ({ lat: r.lat, lng: r.lng }))
    const allPoints = [...plannedPoints, ...trailPoints]
    const local = allPoints.map((p) => toLocalMeters(p, origin))
    const xs = local.map((p) => p.x)
    const ys = local.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const spanX = Math.max(maxX - minX, 1)
    const spanY = Math.max(maxY - minY, 1)
    const scale = Math.min((WIDTH - MARGIN * 2) / spanX, (HEIGHT - MARGIN * 2) / spanY)

    const project = (p: GeoPoint) => {
      const { x, y } = toLocalMeters(p, origin)
      return {
        x: MARGIN + (x - minX) * scale,
        y: HEIGHT - MARGIN - (y - minY) * scale, // flip so "north" (increasing lat) is up
      }
    }

    const buildPath = (points: GeoPoint[]) =>
      points
        .map((p, i) => {
          const s = project(p)
          return `${i === 0 ? 'M' : 'L'} ${s.x.toFixed(1)} ${s.y.toFixed(1)}`
        })
        .join(' ')

    const splitAt = replanTriggerIndex ?? trailPoints.length
    const trailBefore = trailPoints.slice(0, splitAt + 1)
    const trailAfter = trailPoints.slice(splitAt)

    return {
      plannedPath: buildPath(plannedPoints),
      trailBeforePath: buildPath(trailBefore),
      trailAfterPath: trailAfter.length > 1 ? buildPath(trailAfter) : null,
      currentPoint: trailPoints.length > 0 ? project(trailPoints[trailPoints.length - 1]) : null,
      startPoint: project(startPoint),
      endPoint: project(endPoint),
    }
  }, [startPoint, endPoint, waypoints, readings, replanTriggerIndex])

  const latest = readings.length > 0 ? readings[readings.length - 1] : null

  return (
    <Box>
      <Typography variant="caption" color={colors.textMuted} sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
        DRAUFSICHT
      </Typography>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT}>
        <defs>
          <marker id="arrow-planned" markerWidth={8} markerHeight={8} refX={6} refY={4} orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={colors.textMuted} />
          </marker>
          <marker id="arrow-actual" markerWidth={8} markerHeight={8} refX={6} refY={4} orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={colors.accentBlue} />
          </marker>
          <marker id="arrow-corrective" markerWidth={8} markerHeight={8} refX={6} refY={4} orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={colors.accentRed} />
          </marker>
        </defs>
        <path d={layout.plannedPath} fill="none" stroke={colors.textMuted} strokeWidth={1.5} strokeDasharray="5 4" />
        <path d={layout.trailBeforePath} fill="none" stroke={colors.accentBlue} strokeWidth={2} />
        {layout.trailAfterPath && (
          <path d={layout.trailAfterPath} fill="none" stroke={colors.accentGreen} strokeWidth={2} />
        )}
        <circle cx={layout.startPoint.x} cy={layout.startPoint.y} r={5} fill={colors.accentGreen} stroke={colors.bgApp} strokeWidth={1.5} />
        <circle cx={layout.endPoint.x} cy={layout.endPoint.y} r={5} fill={colors.accentRed} stroke={colors.bgApp} strokeWidth={1.5} />
        {layout.currentPoint && latest && guidance && (
          <>
            {(() => {
              const { x, y } = layout.currentPoint!
              const planned = headingToDelta(guidance.plannedHeadingDeg, ARROW_LENGTH_PX)
              const actual = headingToDelta(guidance.actualHeadingDeg, ARROW_LENGTH_PX)
              const corrective = headingToDelta(guidance.correctiveHeadingDeg, ARROW_LENGTH_PX)
              return (
                <>
                  <line
                    x1={x}
                    y1={y}
                    x2={x + planned.dx}
                    y2={y + planned.dy}
                    stroke={colors.textMuted}
                    strokeWidth={2}
                    markerEnd="url(#arrow-planned)"
                  />
                  <line
                    x1={x}
                    y1={y}
                    x2={x + actual.dx}
                    y2={y + actual.dy}
                    stroke={colors.accentBlue}
                    strokeWidth={2}
                    markerEnd="url(#arrow-actual)"
                  />
                  {guidance.showCorrectiveHeading && (
                    <line
                      x1={x}
                      y1={y}
                      x2={x + corrective.dx}
                      y2={y + corrective.dy}
                      stroke={colors.accentRed}
                      strokeWidth={2}
                      strokeDasharray={guidance.correctiveHeadingFeasible ? undefined : '4 3'}
                      opacity={guidance.correctiveHeadingFeasible ? 1 : 0.55}
                      markerEnd="url(#arrow-corrective)"
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
            r={6}
            fill={deviationColor(latest.lateralDeviationM)}
            stroke={colors.bgApp}
            strokeWidth={2}
          />
        )}
      </svg>
      <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
        <ArrowLegend color={colors.textMuted} label="Geplant" />
        <ArrowLegend color={colors.accentBlue} label="Ist" />
        <ArrowLegend color={colors.accentRed} label="Korrektur" dashed={guidance ? !guidance.correctiveHeadingFeasible : false} />
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
