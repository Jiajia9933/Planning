import { buildRoutePoints, routeLengthM, PROFILE_STEPS } from './routeGeometry'
import type { ResolvedPlanningParameters, PlanningResult, ProfileSample } from './types'

const toRad = (deg: number) => (deg * Math.PI) / 180

// ============================================================
// ENGINEERING-TODO: SIMPLIFIED PLACEHOLDER MODEL — REPLACE ME
// ============================================================
// This is a sag-curve stand-in, not a validated bore-path engineering
// calculation. A qualified HDD engineer should replace the BODY of
// computePlanning() below with real formulas (bore-path curvature,
// pullback force, soil bearing, radius-of-curvature limits per pipe
// material/diameter, applicable DVGW/DIN 18300 constraints, etc.).
// KEEP the function signature — params in, {result, profile} out —
// every caller (frontend UI, /api/calculate route) depends on it
// unchanged. Searchable marker: ENGINEERING-TODO
// ============================================================
export function computePlanning(
  params: ResolvedPlanningParameters,
  // Real per-point ground elevation along the route (same index order as
  // `sampleRoutePoints(startPoint, endPoint, waypoints)`, one entry per
  // profile sample), sourced client-side via Cesium terrain sampling — this
  // function has no terrain data source of its own. Omit/undefined falls
  // back to the synthetic placeholder terrain below.
  terrainElevationsM?: number[],
): {
  result: PlanningResult
  profile: ProfileSample[]
} {
  const { startPoint, endPoint, waypoints, minDrillRadiusM, entryAngleDeg, exitAngleDeg, pipeDiameterMm } = params
  const entryRad = toRad(entryAngleDeg)
  const exitRad = toRad(exitAngleDeg)

  const horizontalLengthM = routeLengthM(buildRoutePoints(startPoint, endPoint, waypoints))

  const maxDepthM = minDrillRadiusM * (Math.sin(entryRad) + Math.sin(exitRad))

  const entryArcM = minDrillRadiusM * entryRad
  const exitArcM = minDrillRadiusM * exitRad
  const entryProjectionM = minDrillRadiusM * Math.sin(entryRad)
  const exitProjectionM = minDrillRadiusM * Math.sin(exitRad)
  const straightSectionM = Math.max(horizontalLengthM - entryProjectionM - exitProjectionM, 0)
  const totalLengthM = straightSectionM + entryArcM + exitArcM

  const warnings: string[] = []
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

  const result: PlanningResult = {
    totalLengthM,
    horizontalLengthM,
    maxDepthM,
    minRadiusM: minDrillRadiusM,
    entryPoint: startPoint,
    exitPoint: endPoint,
    warnings,
  }

  return { result, profile: buildProfile(horizontalLengthM, maxDepthM, terrainElevationsM) }
}

function buildProfile(horizontalLengthM: number, maxDepthM: number, terrainElevationsM?: number[]): ProfileSample[] {
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
    // Depth-below-surface sag curve (ENGINEERING-TODO placeholder shape) —
    // measured from *this point's own* terrain height rather than a fixed
    // baseline, so entry/exit sit exactly at ground level and the bore path
    // visually tracks real terrain when real elevation is supplied.
    const depthM = Math.sin(t * Math.PI) * maxDepthM
    const minRadiusDepthM = Math.sin(t * Math.PI) * (maxDepthM * 0.82)
    samples.push({
      distanceM,
      terrainHeightM,
      drillPathHeightM: terrainHeightM - depthM,
      minRadiusHeightM: terrainHeightM - minRadiusDepthM,
    })
  }
  return samples
}
