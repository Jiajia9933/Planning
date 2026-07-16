import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import { colors } from '../../theme/tokens'

const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN

/**
 * Owns the CesiumJS Viewer lifecycle.
 *
 * Without a Cesium Ion token, this renders a flat ellipsoid + free OSM
 * street tiles — zero signup, enough for a "see underground utilities" demo.
 * With `VITE_CESIUM_ION_TOKEN` set (free signup at ion.cesium.com), it
 * upgrades to real World Terrain elevation, satellite imagery and textured
 * OSM 3D Buildings with sun-based lighting, closer to a tool like ArcGIS
 * Scene Viewer. Both paths keep `depthTestAgainstTerrain` off so the
 * underground pipe/drill entities always render through the ground.
 */
export function useCesiumViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const [viewer, setViewer] = useState<Cesium.Viewer | null>(null)
  const [buildingsTileset, setBuildingsTileset] = useState<Cesium.Cesium3DTileset | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let disposed = false

    if (ionToken) {
      Cesium.Ion.defaultAccessToken = ionToken
    }

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
      ...(ionToken
        ? { terrain: Cesium.Terrain.fromWorldTerrain() }
        : { terrainProvider: new Cesium.EllipsoidTerrainProvider() }),
      ...(ionToken
        ? {}
        : {
            baseLayer: new Cesium.ImageryLayer(
              // OSM's raster tiles only exist up to z19 — without this cap,
              // zooming in past that requests nonexistent tiles, whose error
              // responses lack CORS headers and surface as misleading
              // "blocked by CORS" errors.
              new Cesium.OpenStreetMapImageryProvider({
                url: 'https://tile.openstreetmap.org/',
                maximumLevel: 19,
              }),
            ),
          }),
      shadows: !!ionToken,
      requestRenderMode: false,
    })

    instance.scene.globe.depthTestAgainstTerrain = false

    if (ionToken) {
      instance.scene.globe.enableLighting = true
      Cesium.createOsmBuildingsAsync()
        .then((tileset) => {
          if (disposed) return
          instance.scene.primitives.add(tileset)
          setBuildingsTileset(tileset)
        })
        .catch((error: unknown) => console.error('Cesium OSM Buildings failed to load', error))
    } else {
      instance.scene.globe.showGroundAtmosphere = false
      if (instance.scene.skyAtmosphere) instance.scene.skyAtmosphere.show = false
      if (instance.scene.sun) instance.scene.sun.show = false
      if (instance.scene.moon) instance.scene.moon.show = false
      if (instance.scene.skyBox) instance.scene.skyBox.show = false
      instance.scene.backgroundColor = Cesium.Color.fromCssColorString(colors.bgApp)
      instance.scene.globe.baseColor = Cesium.Color.fromCssColorString('#141c11')
    }

    viewerRef.current = instance
    setViewer(instance)

    return () => {
      disposed = true
      instance.destroy()
      viewerRef.current = null
      setViewer(null)
      setBuildingsTileset(null)
    }
  }, [])

  return { containerRef, viewer, buildingsTileset }
}
