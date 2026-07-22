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
  // Instantaneous pitch (vertical angle, degrees, positive = descending) —
  // the vertical counterpart of headingDeg, needed for the same reason:
  // applyManualSteering must be able to continue a *second* vertical kick
  // from wherever the pitch actually currently is, not silently reset to
  // the planned profile's local slope each time (that reset is what
  // produced a near-vertical kink when a kick landed while a previous one
  // was still mid-convergence). Always populated, mirroring headingDeg.
  pitchDeg: number
  // Manual-steering mode only: has this axis ever been kicked away from
  // the plan (this call, or an earlier one)? Explicit and carried forward
  // reading-to-reading rather than inferred from lateral/verticalDeviationM,
  // because once an axis is deliberately frozen it keeps *reporting* a
  // growing deviation from the plan (see applyManualSteering) — inferring
  // "was this kicked?" from that number would wrongly arm the other axis's
  // convergence on a later steer() call. Absent/undefined outside manual
  // mode, where the question doesn't apply.
  headingKicked?: boolean
  verticalKicked?: boolean
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

/** Destination point a given distance out along a compass heading — flat-projection approximation, same convention as offsetPerpendicular. */
function moveByHeading(point: GeoPoint, headingDeg: number, distanceM: number): GeoPoint {
  const rad = (headingDeg * Math.PI) / 180
  const dLat = (Math.cos(rad) * distanceM) / METERS_PER_DEGREE
  const dLng = (Math.sin(rad) * distanceM) / (METERS_PER_DEGREE * Math.cos((point.lat * Math.PI) / 180))
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
 *
 * `manualDrift: true` (the "manuelle Steuerung" Testlauf mode) suppresses
 * this automatic drift entirely — the bit stays exactly on the planned
 * line until the Bauleiter steers it themselves via `applyManualSteering`,
 * matching that mode's whole premise (nothing happens without keyboard
 * input).
 */
export function generateDrillingSession(
  params: ResolvedPlanningParameters,
  options?: { manualDrift?: boolean },
): DrillingReading[] {
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

    const lateralOffsetM = options?.manualDrift ? 0 : driftEnvelope(t) * 4.5 + pseudoNoise(s) * 0.15
    const verticalDeviationM = options?.manualDrift ? 0 : driftEnvelope(t) * 1.8 + pseudoNoise(s * 1.7) * 0.08

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

    const plannedDepthBehind = interpolateDepthAtDistance(profile, Math.max(0, distanceM - 1))
    const plannedDepthAhead = interpolateDepthAtDistance(profile, Math.min(totalLengthM, distanceM + 1))
    const pitchDeg = (Math.atan((plannedDepthAhead - plannedDepthBehind) / 2) * 180) / Math.PI

    readings.push({
      elapsedS: s,
      distanceM,
      lat: actualPoint.lat,
      lng: actualPoint.lng,
      depthM: Math.max(0, plannedDepthM + verticalDeviationM),
      speedMPerMin: Math.max(0.1, AVG_ROP_M_PER_MIN + pseudoNoise(s * 2.3) * 0.15),
      headingDeg,
      pitchDeg,
      forceKn: Math.max(10, BASE_FORCE_KN + plannedDepthM * 1.5 + pseudoNoise(s * 3.1) * 8),
      lateralDeviationM: Math.abs(lateralOffsetM),
      verticalDeviationM,
    })
  }

  return readings
}

/** Signed shortest angular difference target-minus-current, in (-180, 180], handling the 0/360 wraparound. */
function signedAngleDiffDeg(targetDeg: number, currentDeg: number): number {
  let diff = (targetDeg - currentDeg) % 360
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  return diff
}

/**
 * Regenerates the readings tail from `currentReading` onward under manual
 * keyboard steering ("manuelle Steuerung" Testlauf mode). A key press is a
 * one-off *kick* — it instantly rotates the bit's current heading/pitch by
 * `headingKickDeg`/`verticalKickDeg` — not a rudder held forever. From the
 * very next second on, with no further input, the kicked axis automatically
 * steers itself back toward the bearing/pitch that leads straight to the
 * target end point (the same direction the red guidance arrow shows), at a
 * rate capped by `stepM / minDrillRadiusM` — the same physical bend-radius
 * constraint used everywhere else in this app.
 *
 * The two axes are fully independent: a horizontal-only kick (verticalKickDeg
 * omitted) must never move Seitenansicht by even a millimeter, and vice
 * versa. The axis that wasn't kicked doesn't just "follow the plan" (the
 * plan's own heading/depth can still change with distance, e.g. an entry
 * ramp or a bend) — it's held completely frozen at exactly its value from
 * `currentReading`, second after second, until *that* axis is itself
 * kicked. See `DrillingReading.headingKicked`/`verticalKicked` for why this
 * is tracked as an explicit flag rather than inferred from the deviation
 * numbers.
 */
export function applyManualSteering(
  currentReading: DrillingReading,
  params: ResolvedPlanningParameters,
  headingKickDeg: number,
  verticalKickDeg = 0,
): DrillingReading[] {
  const { profile } = computePlanning(params)
  const routePoints = buildRoutePoints(params.startPoint, params.endPoint, params.waypoints)
  const totalLengthM = routeLengthM(routePoints)
  const totalDurationS = Math.max(1, Math.round((totalLengthM / AVG_ROP_M_PER_MIN) * 60))
  const stepM = AVG_ROP_M_PER_MIN / 60
  const maxTurnPerStepDeg = (stepM / params.minDrillRadiusM) * (180 / Math.PI)
  const maxPitchTurnPerStepRad = stepM / params.minDrillRadiusM

  const headingIsKicked = currentReading.headingKicked === true || headingKickDeg !== 0
  const verticalIsKicked = currentReading.verticalKicked === true || verticalKickDeg !== 0

  const readings: DrillingReading[] = []
  let position: GeoPoint = { lat: currentReading.lat, lng: currentReading.lng }
  let depthM = currentReading.depthM
  let currentHeadingDeg = (currentReading.headingDeg + headingKickDeg + 360) % 360
  // Continues from the bit's actual current pitch (same pattern as
  // currentHeadingDeg above) — NOT re-derived from the planned profile's
  // local slope every time. Re-deriving from the plan was the bug: a
  // second kick landing while an earlier one was still mid-convergence
  // would discard that progress and jump to "planned slope + new kick",
  // producing a near-vertical kink instead of continuing smoothly.
  let currentPitchRad = (currentReading.pitchDeg * Math.PI) / 180 + (verticalKickDeg * Math.PI) / 180

  for (let s = currentReading.elapsedS + 1; s <= totalDurationS; s++) {
    const t = Math.min(1, s / totalDurationS)
    const referenceDistanceM = t * totalLengthM
    // Chainage-based, not the bit's literal 3D distance to the target —
    // deliberately independent of `position`, so a horizontal-only kick
    // can never perturb the vertical convergence target (and vice versa).
    const remainingReferenceLengthM = Math.max(totalLengthM - referenceDistanceM, 0.01)

    if (headingIsKicked) {
      const desiredHeadingDeg = bearingDeg(position, params.endPoint)
      const headingDelta = signedAngleDiffDeg(desiredHeadingDeg, currentHeadingDeg)
      const clampedHeadingDelta = Math.max(-maxTurnPerStepDeg, Math.min(maxTurnPerStepDeg, headingDelta))
      currentHeadingDeg = (currentHeadingDeg + clampedHeadingDelta + 360) % 360
    }
    // else: currentHeadingDeg stays exactly what it already was — the bit
    // still moves forward (ROP never stops), just in a straight,
    // uncorrected line, since this axis has never been touched.
    position = moveByHeading(position, currentHeadingDeg, stepM)

    if (verticalIsKicked) {
      const desiredPitchRad = Math.atan(-depthM / remainingReferenceLengthM)
      const pitchDelta = desiredPitchRad - currentPitchRad
      const clampedPitchDelta = Math.max(-maxPitchTurnPerStepRad, Math.min(maxPitchTurnPerStepRad, pitchDelta))
      currentPitchRad += clampedPitchDelta
      depthM = Math.max(0, depthM + Math.tan(currentPitchRad) * stepM)
    }
    // else: depthM stays frozen at currentReading.depthM — no vertical
    // motion at all until the vertical axis is itself kicked. The true
    // instantaneous pitch during a freeze is exactly 0 (flat, not moving),
    // not whatever it happened to be before the freeze — pushed as such
    // below so a *later* vertical kick correctly kicks from level, not
    // from a stale pre-freeze angle.

    const referencePoint = pointAtDistance(routePoints, referenceDistanceM)
    const plannedDepthHereM = interpolateDepthAtDistance(profile, referenceDistanceM)

    readings.push({
      elapsedS: s,
      distanceM: referenceDistanceM,
      lat: position.lat,
      lng: position.lng,
      depthM,
      speedMPerMin: Math.max(0.1, AVG_ROP_M_PER_MIN + pseudoNoise(s * 2.3) * 0.15),
      headingDeg: currentHeadingDeg,
      pitchDeg: verticalIsKicked ? (currentPitchRad * 180) / Math.PI : 0,
      forceKn: Math.max(10, BASE_FORCE_KN + depthM * 1.5 + pseudoNoise(s * 3.1) * 8),
      lateralDeviationM: haversineDistanceM(position, referencePoint),
      verticalDeviationM: depthM - plannedDepthHereM,
      headingKicked: headingIsKicked,
      verticalKicked: verticalIsKicked,
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
 * Fits `depth(d) = p0 + s0·d + a·d²` so it starts at the bit's actual
 * current depth *and* current slope (no discontinuity at d=0 — this is
 * what avoids the sudden kink a naive linear taper produces) and reaches
 * depth 0 at `remainingLengthM`. Closed-form, no spline library — same
 * "explainable placeholder formula" style as the sag curve in
 * planningEngine.ts, just fit to different boundary conditions.
 */
function fitQuadraticDepthTaper(p0: number, s0: number, remainingLengthM: number) {
  const L = Math.max(remainingLengthM, 1e-6)
  const a = -(p0 + s0 * L) / (L * L)
  return {
    depthAt: (d: number) => p0 + s0 * d + a * d * d,
    slopeAt: (d: number) => s0 + 2 * a * d,
    exitSlope: s0 + 2 * a * L,
  }
}

/**
 * Computes a corrected path from wherever the bit actually is back to the
 * original end point, and regenerates telemetry for the rest of the run
 * following *that* line instead of the original plan. Two independent
 * safety checks, both flagged (never blocking — matches "auto-correct, no
 * confirmation"): a horizontal one (matches `routeOptimizer.ts`'s
 * tangent-length turn-radius check against the heading change) and a
 * vertical one (the taper's exit angle against `exitAngleDeg` — the
 * remaining distance might just not be enough to surface gently).
 */
export function replanFromCurrentPosition(
  currentReading: DrillingReading,
  params: ResolvedPlanningParameters,
): ReplanResult {
  const { profile } = computePlanning(params)
  const originalRoutePoints = buildRoutePoints(params.startPoint, params.endPoint, params.waypoints)
  const originalTotalLengthM = routeLengthM(originalRoutePoints)

  const currentPosition: GeoPoint = { lat: currentReading.lat, lng: currentReading.lng }
  const newPlanPoints: GeoPoint[] = [currentPosition, params.endPoint]
  const remainingLengthM = haversineDistanceM(currentPosition, params.endPoint)
  const remainingDurationS = Math.max(1, Math.round((remainingLengthM / AVG_ROP_M_PER_MIN) * 60))

  // The *planned* profile's local depth slope at the trigger distance —
  // same centered-window trick already used for heading — stands in for
  // the bit's actual current pitch, since the real per-second vertical
  // deviation is itself only ever a small addition on top of the plan.
  const depthBehind = interpolateDepthAtDistance(profile, Math.max(0, currentReading.distanceM - 1))
  const depthAhead = interpolateDepthAtDistance(profile, Math.min(originalTotalLengthM, currentReading.distanceM + 1))
  const currentSlope = (depthAhead - depthBehind) / 2

  const { depthAt, slopeAt, exitSlope } = fitQuadraticDepthTaper(currentReading.depthM, currentSlope, remainingLengthM)

  const warnings: string[] = []

  // Horizontal: same tangent-length-to-inscribed-arc formula as
  // routeOptimizer.ts's radiusWarnings.
  const newInitialHeadingDeg = bearingDeg(currentPosition, pointAtDistance(newPlanPoints, Math.min(remainingLengthM, 1)))
  const rawDeltaDeg = Math.abs(newInitialHeadingDeg - currentReading.headingDeg) % 360
  const headingDeflectionDeg = rawDeltaDeg > 180 ? 360 - rawDeltaDeg : rawDeltaDeg
  const requiredApproachM = params.minDrillRadiusM * Math.tan(((headingDeflectionDeg * Math.PI) / 180) / 2)
  if (headingDeflectionDeg > 0.01 && requiredApproachM > Math.min(remainingLengthM, 5)) {
    warnings.push(
      `Die Kurskorrektur erfordert eine engere seitliche Kurve als der minimale Bohrradius (${params.minDrillRadiusM} m) zulässt.`,
    )
  }

  // Vertical: does the taper actually manage to flatten out enough by the
  // time it reaches the surface, or is the remaining distance just too
  // short for how deep the bit currently is?
  const exitAngleDeg = Math.abs((Math.atan(exitSlope) * 180) / Math.PI)
  if (exitAngleDeg > params.exitAngleDeg) {
    warnings.push(
      `Die verbleibende Strecke reicht nicht aus, um mit sicherem Austrittswinkel (max. ${params.exitAngleDeg}°) wieder an die Oberfläche zu gelangen — berechneter Winkel: ${exitAngleDeg.toFixed(1)}°.`,
    )
  }

  const turnWarning = warnings.length > 0 ? warnings.join(' ') : null

  const readings: DrillingReading[] = []
  for (let i = 0; i <= remainingDurationS; i++) {
    const s = currentReading.elapsedS + i
    const t = i / remainingDurationS
    const distanceAlongNewM = t * remainingLengthM
    const point = pointAtDistance(newPlanPoints, distanceAlongNewM)
    const depthM = Math.max(0, depthAt(distanceAlongNewM))

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
      pitchDeg: (Math.atan(slopeAt(distanceAlongNewM)) * 180) / Math.PI,
      forceKn: Math.max(10, BASE_FORCE_KN + depthM * 1.5 + pseudoNoise(s * 3.1) * 8),
      // Small residual noise only — no drift envelope, so the corrected
      // segment doesn't itself drift enough to re-trigger a second replan.
      lateralDeviationM: Math.abs(pseudoNoise(s) * 0.08),
      verticalDeviationM: pseudoNoise(s * 1.7) * 0.05,
    })
  }

  return { newPlanPoints, readings, turnWarning }
}
