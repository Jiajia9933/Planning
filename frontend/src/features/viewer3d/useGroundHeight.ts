import { useEffect, useState } from 'react'
import * as Cesium from 'cesium'
import type { GeoPoint } from '../../types/hdd'

/**
 * Real terrain (World Terrain via Ion) sits tens of meters above/below the
 * WGS84 ellipsoid depending on location — Berlin is ~35-40m above it. Every
 * underground entity height in this app is expressed as "N meters below
 * ground," so it must be offset by the actual ground elevation here, or it
 * renders at the wrong absolute height once real terrain is in use (with the
 * flat EllipsoidTerrainProvider fallback, ground *is* the ellipsoid, so the
 * offset is correctly 0).
 */
export function useGroundHeight(viewer: Cesium.Viewer | null, point: GeoPoint): number {
  const [groundHeightM, setGroundHeightM] = useState(0)

  useEffect(() => {
    if (!viewer) return
    let cancelled = false

    // `Cesium.Terrain.fromWorldTerrain()` resolves its real TerrainProvider
    // asynchronously — `viewer.terrainProvider` can still be undefined for a
    // moment after construction, so this both checks now and re-checks
    // whenever the scene's terrain provider actually changes.
    const trySample = () => {
      const terrainProvider = viewer.terrainProvider
      if (!terrainProvider) return

      if (!terrainProvider.availability) {
        Promise.resolve().then(() => {
          if (!cancelled) setGroundHeightM(0)
        })
        return
      }

      const cartographic = Cesium.Cartographic.fromDegrees(point.lng, point.lat)
      Cesium.sampleTerrainMostDetailed(terrainProvider, [cartographic])
        .then(([sampled]) => {
          if (!cancelled) setGroundHeightM(sampled.height ?? 0)
        })
        .catch(() => {
          if (!cancelled) setGroundHeightM(0)
        })
    }

    trySample()
    const removeListener = viewer.scene.terrainProviderChanged.addEventListener(trySample)

    return () => {
      cancelled = true
      removeListener()
    }
  }, [viewer, point.lat, point.lng])

  return groundHeightM
}
