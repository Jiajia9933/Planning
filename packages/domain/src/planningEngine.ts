import { buildRoutePoints, routeLengthM, PROFILE_STEPS } from './routeGeometry'
import type { Coord } from './lineIntersection'
import type { GeoPoint, ResolvedPlanningParameters, PlanningResult, ProfileSample } from './types'
import type { ParcelFeatureCollection } from './parcels/types'
import { findCrossedParcels } from './parcels/parcelCrossing'
import { optimizeRoute } from './parcels/routeOptimizer'
import { smoothSharpBends } from './bendSmoothing'

const toRad = (deg: number) => (deg * Math.PI) / 180
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export interface ComputePlanningOptions {
  // Real per-point ground elevation along the route (same index order as
  // `sampleRoutePoints(startPoint, endPoint, waypoints)`, one entry per
  // profile sample), sourced client-side via Cesium terrain sampling — this
  // function has no terrain data source of its own. Omit/undefined falls
  // back to the synthetic placeholder terrain below.
  terrainElevationsM?: number[]
  uploadedParcels?: ParcelFeatureCollection | null
}

// ============================================================
// ENGINEERING-TODO: SIMPLIFIED PLACEHOLDER MODEL
// ============================================================
// The vertical profile (entry arc / straight / exit arc) and the horizontal
// avoidance/smoothing steps below are a reasonable geometric approximation,
// not a validated bore-path engineering calculation (pullback force, soil
// bearing, applicable DVGW/DIN 18300 constraints, etc. are out of scope). A
// qualified HDD engineer should review before this drives a real drilling
// operation. KEEP the function signature — params + options in, {result,
// profile, effectiveWaypoints} out — every caller (frontend UI, /api/calculate
// route) depends on it unchanged. Searchable marker: ENGINEERING-TODO
// ============================================================
export function computePlanning(
  params: ResolvedPlanningParameters,
  options: ComputePlanningOptions = {},
): {
  result: PlanningResult
  profile: ProfileSample[]
  effectiveWaypoints: GeoPoint[]
} {
  const { startPoint, endPoint, waypoints, minDrillRadiusM, entryAngleDeg, exitAngleDeg, pipeDiameterMm, maxDeflectionAngleDeg } =
    params
  const { terrainElevationsM, uploadedParcels } = options

  let routePoints = buildRoutePoints(startPoint, endPoint, waypoints)

  // Gate avoidance on whether the CURRENT route crosses a parcel — not the
  // naive straight start->end line — so an already-clean hand-placed route
  // is never needlessly discarded just because some other parcel exists
  // elsewhere in the project.
  if (uploadedParcels && uploadedParcels.features.length > 0) {
    const currentCoords: Coord[] = routePoints.map((p) => [p.lng, p.lat])
    const currentlyCrossed = findCrossedParcels(currentCoords, uploadedParcels)
    if (currentlyCrossed.length > 0) {
      const optimized = optimizeRoute(startPoint, endPoint, uploadedParcels)
      routePoints = buildRoutePoints(startPoint, endPoint, optimized.waypoints)
    }
  }

  const smoothing = smoothSharpBends(routePoints, minDrillRadiusM, maxDeflectionAngleDeg)
  routePoints = smoothing.points
  const effectiveWaypoints = routePoints.slice(1, -1)

  const entryRad = toRad(entryAngleDeg)
  const exitRad = toRad(exitAngleDeg)
  const horizontalLengthM = routeLengthM(routePoints)

  // Vertical drop of an arc of radius R through angle theta is R*(1-cos(theta))
  // — R*sin(theta) (used further down for the arc's *horizontal* projection)
  // would be dimensionally wrong here. When entry/exit angles differ, the
  // shallower side gets a widened radius (never below minDrillRadiusM) so
  // both arcs bottom out at the same maxDepthM, keeping the straight middle
  // section level and both joints continuous — reduces to today's symmetric
  // case when entryAngleDeg === exitAngleDeg.
  const entryDropUnitM = 1 - Math.cos(entryRad)
  const exitDropUnitM = 1 - Math.cos(exitRad)
  const maxDepthM = minDrillRadiusM * Math.max(entryDropUnitM, exitDropUnitM)
  const entryRadiusM = entryDropUnitM >= exitDropUnitM ? minDrillRadiusM : maxDepthM / entryDropUnitM
  const exitRadiusM = exitDropUnitM >= entryDropUnitM ? minDrillRadiusM : maxDepthM / exitDropUnitM

  const entryArcM = entryRadiusM * entryRad
  const exitArcM = exitRadiusM * exitRad
  const entryProjectionM = entryRadiusM * Math.sin(entryRad)
  const exitProjectionM = exitRadiusM * Math.sin(exitRad)
  const straightSectionM = Math.max(horizontalLengthM - entryProjectionM - exitProjectionM, 0)
  const totalLengthM = straightSectionM + entryArcM + exitArcM

  const warnings: string[] = [...smoothing.warnings]
  const minRecommendedRadiusM = (pipeDiameterMm / 1000) * 25
  if (minDrillRadiusM < minRecommendedRadiusM) {
    warnings.push('Bohrradius könnte für den gewählten Rohrdurchmesser zu gering sein.')
  }
  if (maxDepthM < 1.2) {
    warnings.push('Geringe Überdeckung – Mindesttiefe prüfen.')
  }
  if (entryAngleDeg > 18 || exitAngleDeg > 18) {
    warnings.push('Eintritts-/Austrittswinkel ungewöhnlich steil.')
  }
  if (entryAngleDeg > maxDeflectionAngleDeg || exitAngleDeg > maxDeflectionAngleDeg) {
    warnings.push(`Eintritts-/Austrittswinkel überschreitet den maximal zulässigen Ablenkwinkel (${maxDeflectionAngleDeg}°).`)
  }
  if (entryProjectionM + exitProjectionM > horizontalLengthM) {
    warnings.push('Route ist für die gewählten Winkel/Radien zu kurz – Tiefenprofil ist eine Näherung.')
  }

  const result: PlanningResult = {
    totalLengthM,
    horizontalLengthM,
    maxDepthM,
    minRadiusM: minDrillRadiusM,
    entryPoint: startPoint,
    exitPoint: endPoint,
    warnings,
  }

  // Real 3-segment vertical curve (entry arc -> level straight -> exit arc),
  // replacing the old single sine placeholder. At x=0 depth=0 and the slope
  // is tan(entryAngleDeg) (matches the specified entry angle exactly); at
  // the entry/straight joint depth=maxDepthM and the slope is 0 on both
  // sides (arcs are horizontal-tangent at their inner end by elementary
  // circle geometry) — holds symmetrically at the exit joint, for any
  // entry/exit angle combination.
  const depthAtDistance = (distanceM: number): number => {
    if (distanceM <= entryProjectionM) {
      const phi = Math.asin(clamp((entryProjectionM - distanceM) / entryRadiusM, -1, 1))
      return entryRadiusM * (Math.cos(phi) - Math.cos(entryRad))
    }
    if (distanceM >= horizontalLengthM - exitProjectionM) {
      const xe = horizontalLengthM - distanceM
      const phi = Math.asin(clamp((exitProjectionM - xe) / exitRadiusM, -1, 1))
      return exitRadiusM * (Math.cos(phi) - Math.cos(exitRad))
    }
    return maxDepthM
  }

  return {
    result,
    profile: buildProfile(horizontalLengthM, depthAtDistance, terrainElevationsM),
    effectiveWaypoints,
  }
}

function buildProfile(
  horizontalLengthM: number,
  depthAtDistance: (distanceM: number) => number,
  terrainElevationsM?: number[],
): ProfileSample[] {
  const steps = PROFILE_STEPS
  // Fallback used only when the caller has no real elevation for a sample —
  // a fixed baseline plus a decorative wobble, not a stand-in for any real
  // place. Still marked ENGINEERING-TODO-adjacent: it exists purely so the
  // chart has *something* to draw without real terrain data available.
  const fallbackBaseElevationM = 49
  const samples: ProfileSample[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const distanceM = t * horizontalLengthM
    const fallbackTerrainHeightM = fallbackBaseElevationM - Math.sin(t * Math.PI) * 3.5 + Math.sin(t * 11) * 0.25
    const terrainHeightM = terrainElevationsM?.[i] ?? fallbackTerrainHeightM
    // Depth-below-surface, measured from *this point's own* terrain height
    // rather than a fixed baseline, so entry/exit sit exactly at ground
    // level and the bore path visually tracks real terrain when supplied.
    const depthM = depthAtDistance(distanceM)
    const minRadiusDepthM = depthM * 0.82
    samples.push({
      distanceM,
      terrainHeightM,
      drillPathHeightM: terrainHeightM - depthM,
      minRadiusHeightM: terrainHeightM - minRadiusDepthM,
    })
  }
  return samples
}
