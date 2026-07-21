import { useEffect, useState } from 'react'
import * as Cesium from 'cesium'
import type { GeoPoint } from '../../types/hdd'

/**
 * Real terrain (World Terrain via Ion) elevation at each of `points`, in
 * order — the batched, multi-point sibling of `useGroundHeight`. Feeds the
 * side-view's Geländeoberfläche line with real data instead of the domain
 * engine's synthetic placeholder shape. `null` whenever real terrain isn't
 * available (no Ion token — the free EllipsoidTerrainProvider fallback has
 * no elevation data — provider still loading, or no route yet); callers
 * should treat `null` as "fall back to the synthetic shape", not an error.
 */
export function useTerrainProfile(viewer: Cesium.Viewer | null, points: GeoPoint[]): number[] | null {
  const [elevationsM, setElevationsM] = useState<number[] | null>(null)
  // `points` is a fresh array every render — key on content so the sampling
  // effect only re-runs when the actual coordinates change.
  const pointsKey = points.map((p) => `${p.lat},${p.lng}`).join(';')

  useEffect(() => {
    if (!viewer || points.length === 0) {
      Promise.resolve().then(() => setElevationsM(null))
      return
    }
    let cancelled = false

    // Same "terrainProvider can still be undefined right after construction,
    // and World Terrain resolves asynchronously" situation as
    // useGroundHeight — see that file for the full explanation.
    const trySample = () => {
      const terrainProvider = viewer.terrainProvider
      if (!terrainProvider) return

      if (!terrainProvider.availability) {
        if (!cancelled) setElevationsM(null)
        return
      }

      const cartographics = points.map((p) => Cesium.Cartographic.fromDegrees(p.lng, p.lat))
      Cesium.sampleTerrainMostDetailed(terrainProvider, cartographics)
        .then((sampled) => {
          if (!cancelled) setElevationsM(sampled.map((c) => c.height ?? 0))
        })
        .catch(() => {
          if (!cancelled) setElevationsM(null)
        })
    }

    trySample()
    const removeListener = viewer.scene.terrainProviderChanged.addEventListener(trySample)

    return () => {
      cancelled = true
      removeListener()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, pointsKey])

  return elevationsM
}
