import type { ProfileSample } from '../types/hdd'

export type CurveStyle = 'sinus' | 'segmented'

/**
 * Purely a display choice, shared by Seitenansicht and the 3D view so
 * switching one switches both — the underlying engineering result (the
 * server-computed entry-arc/straight/exit-arc profile) is unaffected either
 * way. 'sinus' redraws the same terrain/max-depth data as the older single
 * sine-curve shape some users are more used to reading at a glance.
 */
export function applyCurveStyle(profile: ProfileSample[], style: CurveStyle): ProfileSample[] {
  if (style !== 'sinus' || profile.length === 0) return profile
  const maxDistanceM = profile[profile.length - 1].distanceM
  const maxDepthM = Math.max(...profile.map((p) => p.terrainHeightM - p.drillPathHeightM))
  return profile.map((p) => {
    const t = maxDistanceM === 0 ? 0 : p.distanceM / maxDistanceM
    const depthM = Math.sin(t * Math.PI) * maxDepthM
    const minRadiusDepthM = Math.sin(t * Math.PI) * (maxDepthM * 0.82)
    return { ...p, drillPathHeightM: p.terrainHeightM - depthM, minRadiusHeightM: p.terrainHeightM - minRadiusDepthM }
  })
}
