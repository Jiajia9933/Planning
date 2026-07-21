import { haversineDistanceM } from './geo'
import type { GeoPoint } from './types'

/** The route's control points in order — empty `waypoints` gives a straight line. */
export function buildRoutePoints(start: GeoPoint, end: GeoPoint, waypoints: GeoPoint[]): GeoPoint[] {
  return [start, ...waypoints, end]
}

/** Total route length as the sum of its segments (not just start-to-end distance). */
export function routeLengthM(points: GeoPoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineDistanceM(points[i - 1], points[i])
  }
  return total
}

/**
 * Inserts a new point into an ordered route wherever it adds the least extra
 * length — so clicking near (but not exactly on) the line still produces a
 * sane bend instead of requiring pixel-precise clicking.
 */
export function insertPointAtBestIndex(points: GeoPoint[], newPoint: GeoPoint): GeoPoint[] {
  let bestIndex = points.length
  let bestExtraLengthM = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const originalM = haversineDistanceM(a, b)
    const detourM = haversineDistanceM(a, newPoint) + haversineDistanceM(newPoint, b)
    const extraM = detourM - originalM
    if (extraM < bestExtraLengthM) {
      bestExtraLengthM = extraM
      bestIndex = i + 1
    }
  }
  const next = [...points]
  next.splice(bestIndex, 0, newPoint)
  return next
}

/** Interpolates the point at a given cumulative distance along a multi-segment route. */
export function pointAtDistance(points: GeoPoint[], distanceM: number): GeoPoint {
  if (points.length === 1) return points[0]

  let remaining = distanceM
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const segmentLengthM = haversineDistanceM(a, b)
    if (remaining <= segmentLengthM || i === points.length - 1) {
      const t = segmentLengthM === 0 ? 0 : Math.max(0, Math.min(1, remaining / segmentLengthM))
      return {
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
      }
    }
    remaining -= segmentLengthM
  }
  return points[points.length - 1]
}

/**
 * Number of interior samples `buildProfile()` (planningEngine.ts) divides the
 * route into. Shared so a client that wants to attach real per-point terrain
 * elevation (see `sampleRoutePoints`) produces an array that lines up
 * index-for-index with the server's own profile samples.
 */
export const PROFILE_STEPS = 32

/** The real-world lat/lng of each of `buildProfile()`'s samples, in order — evenly spaced by distance along the route, not by control point. */
export function sampleRoutePoints(
  start: GeoPoint,
  end: GeoPoint,
  waypoints: GeoPoint[],
  steps: number = PROFILE_STEPS,
): GeoPoint[] {
  const routePoints = buildRoutePoints(start, end, waypoints)
  const totalLengthM = routeLengthM(routePoints)
  const samples: GeoPoint[] = []
  for (let i = 0; i <= steps; i++) {
    samples.push(pointAtDistance(routePoints, (i / steps) * totalLengthM))
  }
  return samples
}
