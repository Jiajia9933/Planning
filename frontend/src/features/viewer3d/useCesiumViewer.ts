import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import { colors } from '../../theme/tokens'

/**
 * Owns the CesiumJS Viewer lifecycle. Deliberately avoids any Cesium Ion
 * asset (world terrain, world imagery, geocoder) so the 3D view works with
 * zero signup/token — a flat ellipsoid plus free OpenStreetMap tiles for the
 * surface, which is all a "see underground utilities" demo scene needs.
 * Swap in `Cesium.Terrain.fromWorldTerrain()` + an Ion token later if real
 * elevation data becomes worth the signup.
 */
export function useCesiumViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const instance = new Cesium.Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      baseLayer: new Cesium.ImageryLayer(
        // OSM's raster tiles only exist up to z19 — without this cap, zooming
        // in past that requests nonexistent tiles, whose error responses lack
        // CORS headers and surface as misleading "blocked by CORS" errors.
        new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/', maximumLevel: 19 }),
      ),
      shadows: false,
      requestRenderMode: false,
    })

    instance.scene.globe.depthTestAgainstTerrain = false
    instance.scene.globe.showGroundAtmosphere = false
    if (instance.scene.skyAtmosphere) instance.scene.skyAtmosphere.show = false
    if (instance.scene.sun) instance.scene.sun.show = false
    if (instance.scene.moon) instance.scene.moon.show = false
    if (instance.scene.skyBox) instance.scene.skyBox.show = false
    instance.scene.backgroundColor = Cesium.Color.fromCssColorString(colors.bgApp)
    instance.scene.globe.baseColor = Cesium.Color.fromCssColorString('#141c11')

    viewerRef.current = instance
    setViewer(instance)

    return () => {
      instance.destroy()
      viewerRef.current = null
      setViewer(null)
    }
  }, [])

  return { containerRef, viewer }
}
