import { haversineDistanceM } from './geo'
import type { GeoPoint } from './types'

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Angle between the incoming and outgoing direction vectors at `curr` — 0 for a straight continuation, up to π for a full reversal. Same locally-planar lng/lat simplification `segmentIntersection` already uses at this scale. */
export function deflectionAngleRad(prev: GeoPoint, curr: GeoPoint, next: GeoPoint): number {
  const v1 = { x: curr.lng - prev.lng, y: curr.lat - prev.lat }
  const v2 = { x: next.lng - curr.lng, y: next.lat - curr.lat }
  const mag1 = Math.hypot(v1.x, v1.y)
  const mag2 = Math.hypot(v2.x, v2.y)
  if (mag1 === 0 || mag2 === 0) return 0
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2)))
  return Math.acos(cos)
}

function lerp(a: GeoPoint, b: GeoPoint, t: number): GeoPoint {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }
}

/**
 * A bend is undrillable if it's sharper than the maximum deflection angle a
 * real drill pipe can turn through, or if its inscribed-arc tangent length
 * (`R * tan(Δ/2)`, standard curve-design geometry) doesn't fit within either
 * adjacent segment.
 */
function violatesBend(
  prev: GeoPoint,
  curr: GeoPoint,
  next: GeoPoint,
  minDrillRadiusM: number,
  maxDeflectionRad: number,
): boolean {
  const theta = deflectionAngleRad(prev, curr, next)
  if (theta < 1e-6) return false
  if (theta > maxDeflectionRad) return true
  const requiredApproachM = minDrillRadiusM * Math.tan(theta / 2)
  const segBeforeM = haversineDistanceM(prev, curr)
  const segAfterM = haversineDistanceM(curr, next)
  return requiredApproachM > segBeforeM || requiredApproachM > segAfterM
}

export interface BendSmoothingResult {
  points: GeoPoint[]
  warnings: string[]
}

// Cutting only 25% in from each neighbor (not 50%) leaves headroom so
// repeated cuts on the same original corner don't collapse into flanking
// vertices within a few passes. The cut is exact regardless of fraction —
// the new chord (B - A) is always parallel to the original bend's chord
// (Q - P), so the turn is only ever redistributed across more, gentler
// vertices, never discarded.
const CUT_FRACTION = 0.25

/**
 * Auto-inserts transition waypoints at any interior vertex whose bend is
 * either sharper than `maxDeflectionAngleDeg` or tighter than what
 * `minDrillRadiusM` can achieve — a real drill pipe cannot suddenly rotate
 * through a near-reversal. Iterates in full passes over the whole point
 * list, stopping early once a pass finds no violations; if the cap is
 * reached with a bend still violating, returns the best-effort (still
 * strictly gentler than the original) points plus a warning.
 */
export function smoothSharpBends(
  points: GeoPoint[],
  minDrillRadiusM: number,
  maxDeflectionAngleDeg: number,
  maxIterations = 8,
): BendSmoothingResult {
  const maxDeflectionRad = toRad(maxDeflectionAngleDeg)
  let current = points

  for (let iter = 0; iter < maxIterations; iter++) {
    let anyViolation = false
    const next: GeoPoint[] = [current[0]]
    for (let i = 1; i < current.length - 1; i++) {
      const prev = current[i - 1]
      const curr = current[i]
      const after = current[i + 1]
      if (violatesBend(prev, curr, after, minDrillRadiusM, maxDeflectionRad)) {
        anyViolation = true
        next.push(lerp(curr, prev, CUT_FRACTION), lerp(curr, after, CUT_FRACTION))
      } else {
        next.push(curr)
      }
    }
    next.push(current[current.length - 1])
    current = next
    if (!anyViolation) break
  }

  const warnings: string[] = []
  for (let i = 1; i < current.length - 1; i++) {
    if (violatesBend(current[i - 1], current[i], current[i + 1], minDrillRadiusM, maxDeflectionRad)) {
      warnings.push(
        'Eine Kurve bleibt trotz automatischer Glättung enger als der minimale Bohrradius oder der maximale Ablenkwinkel zulässt — bitte manuell anpassen.',
      )
      break
    }
  }

  return { points: current, warnings }
}
