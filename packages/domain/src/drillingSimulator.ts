import { computePlanning } from './planningEngine'
import { buildRoutePoints, pointAtDistance, routeLengthM } from './routeGeometry'
import { bearingDeg, haversineDistanceM } from './geo'
import { interpolateDepthAtDistance } from './conflictDetection'
import type { GeoPoint, ResolvedPlanningParameters } from './types'

export interface DrillingReading {
  elapsedS: number
  distanceM: number
  lat: number
  lng: number
  depthM: number
  speedMPerMin: number
  headingDeg: number
  forceKn: number
  lateralDeviationM: number
  verticalDeviationM: number
}

// Placeholder ranges standing in for real sensor telemetry — like the
// ENGINEERING-TODO sag-curve model in planningEngine.ts, not validated
// figures, just plausible enough to exercise the pipeline realistically.
const AVG_ROP_M_PER_MIN = 0.8
const BASE_FORCE_KN = 70
const METERS_PER_DEGREE = 111_320

function offsetPerpendicular(point: GeoPoint, headingDeg: number, offsetM: number): GeoPoint {
  const perpendicularRad = ((headingDeg + 90) * Math.PI) / 180
  const dLat = (Math.cos(perpendicularRad) * offsetM) / METERS_PER_DEGREE
  const dLng = (Math.sin(perpendicularRad) * offsetM) / (METERS_PER_DEGREE * Math.cos((point.lat * Math.PI) / 180))
  return { lat: point.lat + dLat, lng: point.lng + dLng }
}

/**
 * Deterministic drift envelope, not pure randomness — matches this
 * codebase's preference for explainable simplified models. Ramps up
 * around 40-75% of the bore and partially self-corrects, so a demo run
 * reliably shows a real deviation event instead of possibly-boring flat
 * noise the whole way through.
 */
function driftEnvelope(t: number): number {
  if (t < 0.4 || t > 0.75) return 0
  const local = (t - 0.4) / 0.35
  return Math.sin(local * Math.PI)
}

/** Deterministic, cheap "noise" — reproducible run to run, no PRNG needed for a demo dataset. */
function pseudoNoise(seed: number): number {
  return Math.sin(seed * 12.9898) * 0.5
}

/**
 * Generates a full second-by-second simulated telemetry series for the
 * given plan — standing in for a real sensor feed until one exists. The
 * "actual" position at each second is the planned route's own point at
 * that distance, offset sideways by a deliberately-injected deviation, so
 * downstream Soll-Ist comparison has something real to show.
 */
export function generateDrillingSession(params: ResolvedPlanningParameters): DrillingReading[] {
  const { profile } = computePlanning(params)
  const routePoints = buildRoutePoints(params.startPoint, params.endPoint, params.waypoints)
  const totalLengthM = routeLengthM(routePoints)
  const totalDurationS = Math.max(1, Math.round((totalLengthM / AVG_ROP_M_PER_MIN) * 60))

  const readings: DrillingReading[] = []

  for (let s = 0; s <= totalDurationS; s++) {
    const t = s / totalDurationS
    const distanceM = t * totalLengthM
    const plannedPoint = pointAtDistance(routePoints, distanceM)
    const plannedDepthM = interpolateDepthAtDistance(profile, distanceM)

    const lateralOffsetM = driftEnvelope(t) * 2.5 + pseudoNoise(s) * 0.15
    const verticalDeviationM = driftEnvelope(t) * 0.6 + pseudoNoise(s * 1.7) * 0.08

    // A ~2m centered window along the *planned* route gives a numerically
    // stable heading — the per-second movement of the actual point itself
    // is only millimeters (real ROP is ~0.01m/s), far too short a baseline
    // to measure a stable bearing between consecutive actual points
    // directly. Centered (not a pure lookahead) so it stays well-defined
    // right at the endpoints too, instead of the lookahead point clamping
    // onto the same point as the current one near the very end.
    const behindPoint = pointAtDistance(routePoints, Math.max(0, distanceM - 1))
    const aheadPoint = pointAtDistance(routePoints, Math.min(totalLengthM, distanceM + 1))
    const headingDeg = bearingDeg(behindPoint, aheadPoint)
    const actualPoint = offsetPerpendicular(plannedPoint, headingDeg, lateralOffsetM)

    readings.push({
      elapsedS: s,
      distanceM,
      lat: actualPoint.lat,
      lng: actualPoint.lng,
      depthM: Math.max(0, plannedDepthM + verticalDeviationM),
      speedMPerMin: Math.max(0.1, AVG_ROP_M_PER_MIN + pseudoNoise(s * 2.3) * 0.15),
      headingDeg,
      forceKn: Math.max(10, BASE_FORCE_KN + plannedDepthM * 1.5 + pseudoNoise(s * 3.1) * 8),
      lateralDeviationM: Math.abs(lateralOffsetM),
      verticalDeviationM,
    })
  }

  return readings
}

export interface ReplanResult {
  /** [currentPosition, originalEndPoint] — the new (straight-line) plan. */
  newPlanPoints: GeoPoint[]
  /** Replacement tail, elapsedS continuing seamlessly from currentReading. */
  readings: DrillingReading[]
  turnWarning: string | null
}

/**
 * Computes a corrected path from wherever the bit actually is back to the
 * original end point, and regenerates telemetry for the rest of the run
 * following *that* line instead of the original plan. Deliberately matches
 * `routeOptimizer.ts`'s level of rigor, not a new one: a straight
 * reconnection (nothing to route around here, unlike Flurstücke avoidance)
 * with the same tangent-length turn-radius check, applied automatically —
 * flagged if too sharp, never blocked, matching "auto-correct, no
 * confirmation."
 */
export function replanFromCurrentPosition(
  currentReading: DrillingReading,
  originalEndPoint: GeoPoint,
  minDrillRadiusM: number,
): ReplanResult {
  const currentPosition: GeoPoint = { lat: currentReading.lat, lng: currentReading.lng }
  const newPlanPoints: GeoPoint[] = [currentPosition, originalEndPoint]
  const remainingLengthM = haversineDistanceM(currentPosition, originalEndPoint)
  const remainingDurationS = Math.max(1, Math.round((remainingLengthM / AVG_ROP_M_PER_MIN) * 60))

  // Same tangent-length-to-inscribed-arc formula as routeOptimizer.ts's
  // radiusWarnings — deflection from the bit's actual current heading into
  // the new straight line, checked against the available distance.
  const newInitialHeadingDeg = bearingDeg(currentPosition, pointAtDistance(newPlanPoints, Math.min(remainingLengthM, 1)))
  const rawDeltaDeg = Math.abs(newInitialHeadingDeg - currentReading.headingDeg) % 360
  const deflectionDeg = rawDeltaDeg > 180 ? 360 - rawDeltaDeg : rawDeltaDeg
  const requiredApproachM = minDrillRadiusM * Math.tan(((deflectionDeg * Math.PI) / 180) / 2)
  const turnWarning =
    deflectionDeg > 0.01 && requiredApproachM > Math.min(remainingLengthM, 5)
      ? `Die Kurskorrektur erfordert eine engere Kurve als der minimale Bohrradius (${minDrillRadiusM} m) zulässt — bitte prüfen.`
      : null

  const readings: DrillingReading[] = []
  for (let i = 0; i <= remainingDurationS; i++) {
    const s = currentReading.elapsedS + i
    const t = i / remainingDurationS
    const distanceAlongNewM = t * remainingLengthM
    const point = pointAtDistance(newPlanPoints, distanceAlongNewM)
    const depthM = Math.max(0, currentReading.depthM * (1 - t))

    const behindPoint = pointAtDistance(newPlanPoints, Math.max(0, distanceAlongNewM - 1))
    const aheadPoint = pointAtDistance(newPlanPoints, Math.min(remainingLengthM, distanceAlongNewM + 1))
    const headingDeg = bearingDeg(behindPoint, aheadPoint)

    readings.push({
      elapsedS: s,
      distanceM: currentReading.distanceM + distanceAlongNewM,
      lat: point.lat,
      lng: point.lng,
      depthM,
      speedMPerMin: Math.max(0.1, AVG_ROP_M_PER_MIN + pseudoNoise(s * 2.3) * 0.15),
      headingDeg,
      forceKn: Math.max(10, BASE_FORCE_KN + depthM * 1.5 + pseudoNoise(s * 3.1) * 8),
      // Small residual noise only — no drift envelope, so the corrected
      // segment doesn't itself drift enough to re-trigger a second replan.
      lateralDeviationM: Math.abs(pseudoNoise(s) * 0.08),
      verticalDeviationM: pseudoNoise(s * 1.7) * 0.05,
    })
  }

  return { newPlanPoints, readings, turnWarning }
}
