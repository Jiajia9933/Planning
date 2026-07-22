import { bearingDeg, haversineDistanceM, interpolateDepthAtDistance } from '@hdd-planner/domain'
import type { DrillingReading, GeoPoint, ProfileSample } from '@hdd-planner/domain'
import { optimizeRoute } from '../../domain/routeOptimizer'
import type { ParcelFeatureCollection } from '../../domain/flurstuecke/shapefileImport'
import { TREND_MIN_ABSOLUTE_M } from './constants'

export interface GuidanceArrows {
  actualHeadingDeg: number
  plannedHeadingDeg: number
  correctiveHeadingDeg: number
  correctiveHeadingFeasible: boolean
  showCorrectiveHeading: boolean
  actualVerticalAngleDeg: number
  plannedVerticalAngleDeg: number
  correctiveVerticalAngleDeg: number
  correctiveVerticalFeasible: boolean
  showCorrectiveVertical: boolean
  warningText: string | null
}

// A live sensor feed would only ever know the trail behind "now", never
// data ahead of it — unlike the domain package's own centered-window
// heading calc (which is free to look at the fully-known static plan). One
// second of simulated travel is only millimeters, so we walk back along the
// actual trail until we've covered a real baseline instead of using
// adjacent readings directly.
const TRAILING_WINDOW_M = 1

// Below this, the bit hasn't moved far enough yet for the trailing window
// to reflect anything but the simulator's own zero-mean noise (its
// amplitude alone is ~0.075m) — bearing/slope over a shorter baseline is
// noise-dominated and would flash a spurious large actual-vs-planned
// divergence right as a run starts. Below the floor, fall back to the
// planned values instead of a meaningless direction.
const MIN_BASELINE_M = 0.3

function findTrailingReading(readings: DrillingReading[], fromIndex: number, offsetM: number): DrillingReading {
  const targetDistance = readings[fromIndex].distanceM - offsetM
  let i = fromIndex
  while (i > 0 && readings[i].distanceM > targetDistance) i--
  return readings[i]
}

/**
 * Computes the three live guidance arrows shown at the bit's current
 * position in Draufsicht/Seitenansicht: where it's actually pointing, where
 * the original plan says it should point, and where it would need to point
 * right now to still reach the target — avoiding Flurstücke ("Route
 * optimieren"'s own visibility-graph planner, re-run fresh from the bit's
 * actual current position every time this is called) and flagged if that
 * correction itself can't be flown within the minimum drill radius or exit
 * angle. Recomputed on every new reading — see the "Testlauf" plan for why
 * this needs to react earlier than a discrete trigger-once replan.
 */
export function computeGuidanceArrows(
  readings: DrillingReading[],
  endPoint: GeoPoint,
  profile: ProfileSample[],
  parcels: ParcelFeatureCollection | null,
  minDrillRadiusM: number,
  exitAngleDeg: number,
): GuidanceArrows | null {
  if (readings.length === 0) return null
  const latest = readings[readings.length - 1]
  const currentPosition: GeoPoint = { lat: latest.lat, lng: latest.lng }
  const trailing = findTrailingReading(readings, readings.length - 1, TRAILING_WINDOW_M)
  const trailingPosition: GeoPoint = { lat: trailing.lat, lng: trailing.lng }
  const hasBaseline = haversineDistanceM(trailingPosition, currentPosition) > MIN_BASELINE_M

  // headingDeg on a reading is already computed from the original planned
  // route (see drillingSimulator.ts), not the actual/offset trail — free.
  const plannedHeadingDeg = latest.headingDeg
  const actualHeadingDeg = hasBaseline ? bearingDeg(trailingPosition, currentPosition) : plannedHeadingDeg

  const plannedDepthBehind = interpolateDepthAtDistance(profile, Math.max(0, latest.distanceM - TRAILING_WINDOW_M))
  const plannedDepthAhead = interpolateDepthAtDistance(profile, latest.distanceM + TRAILING_WINDOW_M)
  const plannedVerticalAngleDeg =
    (Math.atan((plannedDepthAhead - plannedDepthBehind) / (2 * TRAILING_WINDOW_M)) * 180) / Math.PI

  const actualVerticalAngleDeg = hasBaseline
    ? (Math.atan((latest.depthM - trailing.depthM) / (latest.distanceM - trailing.distanceM)) * 180) / Math.PI
    : plannedVerticalAngleDeg

  const remainingLengthM = Math.max(haversineDistanceM(currentPosition, endPoint), 0.01)

  const optimized = optimizeRoute(currentPosition, endPoint, parcels, minDrillRadiusM)
  const nextPoint = optimized.waypoints[0] ?? endPoint
  const correctiveHeadingDeg = bearingDeg(currentPosition, nextPoint)

  // Same tangent-length-to-inscribed-arc check replanFromCurrentPosition
  // uses — this is deliberately a live preview of what that endpoint would
  // compute if triggered right now.
  const rawDeltaDeg = Math.abs(correctiveHeadingDeg - actualHeadingDeg) % 360
  const headingDeflectionDeg = rawDeltaDeg > 180 ? 360 - rawDeltaDeg : rawDeltaDeg
  const requiredApproachM = minDrillRadiusM * Math.tan(((headingDeflectionDeg * Math.PI) / 180) / 2)
  const headingRadiusOk = !(headingDeflectionDeg > 0.01 && requiredApproachM > Math.min(remainingLengthM, 5))
  const correctiveHeadingFeasible = headingRadiusOk && optimized.warnings.length === 0

  // Straight chord from the bit's actual current depth back to the surface
  // at the target end point — negative (climbing) once depth > 0.
  const correctiveVerticalAngleDeg = (Math.atan(-latest.depthM / remainingLengthM) * 180) / Math.PI
  const correctiveVerticalFeasible = Math.abs(correctiveVerticalAngleDeg) <= exitAngleDeg

  // Ist and Geplant already coincide (within the simulator's own noise
  // floor) — there's nothing to correct yet, so the corrective arrow would
  // just be pointing at "straight to the target", which is misleading to
  // show as a distinct "correction". Same floor the trend-based replan
  // trigger uses, for the same reason (see useDrillingSession.ts).
  const showCorrectiveHeading = Math.abs(latest.lateralDeviationM) >= TREND_MIN_ABSOLUTE_M
  const showCorrectiveVertical = Math.abs(latest.verticalDeviationM) >= TREND_MIN_ABSOLUTE_M

  const warnings: string[] = []
  if (showCorrectiveHeading) {
    if (!headingRadiusOk) {
      warnings.push(`Kurskorrektur enger als der minimale Bohrradius (${minDrillRadiusM} m) zulässt.`)
    }
    warnings.push(...optimized.warnings)
  }
  if (showCorrectiveVertical && !correctiveVerticalFeasible) {
    warnings.push(
      `Erforderlicher Austrittswinkel (${Math.abs(correctiveVerticalAngleDeg).toFixed(1)}°) überschreitet das Limit (${exitAngleDeg}°).`,
    )
  }

  return {
    actualHeadingDeg,
    plannedHeadingDeg,
    correctiveHeadingDeg,
    correctiveHeadingFeasible,
    showCorrectiveHeading,
    actualVerticalAngleDeg,
    plannedVerticalAngleDeg,
    correctiveVerticalAngleDeg,
    correctiveVerticalFeasible,
    showCorrectiveVertical,
    warningText: warnings.length > 0 ? warnings.join(' ') : null,
  }
}
