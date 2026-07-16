import { haversineDistanceM } from './geo'
import type { PlanningParameters, PlanningResult, ProfileSample } from '../types/hdd'

const toRad = (deg: number) => (deg * Math.PI) / 180

// Simplified HDD sag-curve model — not a substitute for a real bore-path
// engineering calc, but a genuine function of the inputs (radius, angles,
// span) rather than fixed numbers, so a real engine can replace this module
// later without changing any caller.
export function computePlanning(params: PlanningParameters): {
  result: PlanningResult
  profile: ProfileSample[]
} {
  const { startPoint, endPoint, minDrillRadiusM, entryAngleDeg, exitAngleDeg, pipeDiameterMm } = params
  const entryRad = toRad(entryAngleDeg)
  const exitRad = toRad(exitAngleDeg)

  const horizontalLengthM = haversineDistanceM(startPoint, endPoint)

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

  return { result, profile: buildProfile(horizontalLengthM, maxDepthM) }
}

function buildProfile(horizontalLengthM: number, maxDepthM: number): ProfileSample[] {
  const steps = 32
  const baseElevationM = 49
  const samples: ProfileSample[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const distanceM = t * horizontalLengthM
    const terrainHeightM = baseElevationM - Math.sin(t * Math.PI) * 3.5 + Math.sin(t * 11) * 0.25
    const drillPathHeightM = baseElevationM - Math.sin(t * Math.PI) * maxDepthM
    const minRadiusHeightM = baseElevationM - Math.sin(t * Math.PI) * (maxDepthM * 0.82)
    samples.push({ distanceM, terrainHeightM, drillPathHeightM, minRadiusHeightM })
  }
  return samples
}
