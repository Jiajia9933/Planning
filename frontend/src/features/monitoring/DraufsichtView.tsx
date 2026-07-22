import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import { buildRoutePoints } from '@hdd-planner/domain'
import type { DrillingReading, GeoPoint } from '@hdd-planner/domain'
import { colors } from '../../theme/tokens'
import { deviationColor } from './constants'

const WIDTH = 640
const HEIGHT = 260
const MARGIN = 24
const METERS_PER_DEGREE = 111_320

interface DraufsichtViewProps {
  startPoint: GeoPoint
  endPoint: GeoPoint
  waypoints: GeoPoint[]
  readings: DrillingReading[]
  replanTriggerIndex: number | null
}

function toLocalMeters(point: GeoPoint, origin: GeoPoint): { x: number; y: number } {
  return {
    x: (point.lng - origin.lng) * METERS_PER_DEGREE * Math.cos((origin.lat * Math.PI) / 180),
    y: (point.lat - origin.lat) * METERS_PER_DEGREE,
  }
}

/** Plan-view (bird's-eye) of the planned route vs. the actual simulated trail — local-planar projection, same simplification used throughout this codebase (lineIntersection.ts, routeOptimizer.ts), not a real map. */
export function DraufsichtView({ startPoint, endPoint, waypoints, readings, replanTriggerIndex }: DraufsichtViewProps) {
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
        <path d={layout.plannedPath} fill="none" stroke={colors.textMuted} strokeWidth={1.5} strokeDasharray="5 4" />
        <path d={layout.trailBeforePath} fill="none" stroke={colors.accentBlue} strokeWidth={2} />
        {layout.trailAfterPath && (
          <path d={layout.trailAfterPath} fill="none" stroke={colors.accentGreen} strokeWidth={2} />
        )}
        <circle cx={layout.startPoint.x} cy={layout.startPoint.y} r={5} fill={colors.accentGreen} stroke={colors.bgApp} strokeWidth={1.5} />
        <circle cx={layout.endPoint.x} cy={layout.endPoint.y} r={5} fill={colors.accentRed} stroke={colors.bgApp} strokeWidth={1.5} />
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
    </Box>
  )
}
