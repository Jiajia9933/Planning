import { haversineDistanceM } from './geo'
import { segmentIntersection } from './lineIntersection'
import { utilityDepthsM } from './utilityDepths'
import { buildDrillRouteFeature, buildUtilityLinesFeatureCollection } from './mockGeometry'
import type { GeoPoint, PlanningParameters, ProfileSample, UtilityCrossing, UtilityType } from '../types/hdd'

function interpolateDepthAtDistance(profile: ProfileSample[], distanceM: number): number {
  if (profile.length === 0) return 0
  if (distanceM <= profile[0].distanceM) {
    return profile[0].terrainHeightM - profile[0].drillPathHeightM
  }
  const last = profile[profile.length - 1]
  if (distanceM >= last.distanceM) {
    return last.terrainHeightM - last.drillPathHeightM
  }
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i]
    const b = profile[i + 1]
    if (distanceM >= a.distanceM && distanceM <= b.distanceM) {
      const span = b.distanceM - a.distanceM
      const t = span === 0 ? 0 : (distanceM - a.distanceM) / span
      const terrain = a.terrainHeightM + (b.terrainHeightM - a.terrainHeightM) * t
      const drill = a.drillPathHeightM + (b.drillPathHeightM - a.drillPathHeightM) * t
      return terrain - drill
    }
  }
  return 0
}

/**
 * Finds where the planned bore's plan-view route crosses pre-existing
 * utility lines, and — using each utility's typical burial depth and the
 * bore's computed depth at that point — flags crossings closer than the
 * required safety distance as conflicts. Existing utilities must not be
 * struck during drilling; a hit is expensive and slow to repair.
 */
export function detectUtilityConflicts(
  params: PlanningParameters,
  profile: ProfileSample[],
  utilityTypes: UtilityType[],
): UtilityCrossing[] {
  const routeFeature = buildDrillRouteFeature(params.startPoint, params.endPoint)
  const routeCoords = routeFeature.geometry.coordinates as [number, number][]
  const utilities = buildUtilityLinesFeatureCollection(params.startPoint, params.endPoint, utilityTypes)

  const cumulativeDistances: number[] = [0]
  for (let i = 1; i < routeCoords.length; i++) {
    const prev: GeoPoint = { lng: routeCoords[i - 1][0], lat: routeCoords[i - 1][1] }
    const curr: GeoPoint = { lng: routeCoords[i][0], lat: routeCoords[i][1] }
    cumulativeDistances.push(cumulativeDistances[i - 1] + haversineDistanceM(prev, curr))
  }

  const crossings: UtilityCrossing[] = []

  for (const feature of utilities.features) {
    const [b1, b2] = feature.geometry.coordinates as [number, number][]
    const type = feature.properties.type

    for (let i = 0; i < routeCoords.length - 1; i++) {
      const a1 = routeCoords[i]
      const a2 = routeCoords[i + 1]
      const hit = segmentIntersection(a1, a2, b1, b2)
      if (!hit) continue

      const segmentLengthM = cumulativeDistances[i + 1] - cumulativeDistances[i]
      const distanceM = cumulativeDistances[i] + hit.t * segmentLengthM
      const drillDepthM = interpolateDepthAtDistance(profile, distanceM)
      const utilityDepthM = utilityDepthsM[type]
      const clearanceM = Math.abs(drillDepthM - utilityDepthM)

      crossings.push({
        type,
        point: { lng: hit.point[0], lat: hit.point[1] },
        distanceM,
        drillDepthM,
        utilityDepthM,
        clearanceM,
        isConflict: clearanceM < params.safetyDistanceM,
      })
    }
  }

  return crossings.sort((a, b) => a.distanceM - b.distanceM)
}
