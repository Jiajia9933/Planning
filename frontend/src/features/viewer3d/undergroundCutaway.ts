import * as Cesium from 'cesium'
import { colors } from '../../theme/tokens'
import type { GeoPoint } from '../../types/hdd'

const SOIL_WALL_COLOR = Cesium.Color.fromCssColorString('#5b4632')
const SOIL_FLOOR_COLOR = Cesium.Color.fromCssColorString('#42311f')

export interface CutawayHandle {
  dataSource: Cesium.CustomDataSource
  globePlanes: Cesium.ClippingPlaneCollection
  tilesetPlanes: Cesium.ClippingPlaneCollection | null
}

/**
 * Carves a square pit out of the globe (and, if present, the OSM Buildings
 * tileset) centered on the project site, and fills the resulting void with a
 * soil-colored wall + floor so what's revealed reads as "excavated ground"
 * rather than a rendering hole. This is the only way to make the buried
 * pipes/drill tube — normally just 1-15m down, invisible at any real-world
 * viewing distance — actually look like they're *underground* rather than
 * lines floating on top of the terrain.
 */
export function applyCutaway(
  viewer: Cesium.Viewer,
  center: GeoPoint,
  groundHeightM: number,
  radiusM: number,
  pitDepthM: number,
  buildingsTileset: Cesium.Cesium3DTileset | null,
): CutawayHandle {
  const origin = Cesium.Cartesian3.fromDegrees(center.lng, center.lat, groundHeightM)
  const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(origin)

  const makePlanes = () => [
    new Cesium.ClippingPlane(new Cesium.Cartesian3(-1, 0, 0), -radiusM),
    new Cesium.ClippingPlane(new Cesium.Cartesian3(1, 0, 0), -radiusM),
    new Cesium.ClippingPlane(new Cesium.Cartesian3(0, -1, 0), -radiusM),
    new Cesium.ClippingPlane(new Cesium.Cartesian3(0, 1, 0), -radiusM),
  ]

  const globePlanes = new Cesium.ClippingPlaneCollection({
    planes: makePlanes(),
    modelMatrix,
    unionClippingRegions: false,
    edgeColor: Cesium.Color.fromCssColorString(colors.accentOrange),
    edgeWidth: 2,
  })
  viewer.scene.globe.clippingPlanes = globePlanes

  let tilesetPlanes: Cesium.ClippingPlaneCollection | null = null
  if (buildingsTileset) {
    tilesetPlanes = new Cesium.ClippingPlaneCollection({
      planes: makePlanes(),
      modelMatrix,
      unionClippingRegions: false,
    })
    buildingsTileset.clippingPlanes = tilesetPlanes
  }

  const toWorld = (x: number, y: number, z: number) =>
    Cesium.Matrix4.multiplyByPoint(modelMatrix, new Cesium.Cartesian3(x, y, z), new Cesium.Cartesian3())

  const topCorners = [
    toWorld(-radiusM, -radiusM, 0),
    toWorld(radiusM, -radiusM, 0),
    toWorld(radiusM, radiusM, 0),
    toWorld(-radiusM, radiusM, 0),
  ]
  const bottomCorners = [
    toWorld(-radiusM, -radiusM, -pitDepthM),
    toWorld(radiusM, -radiusM, -pitDepthM),
    toWorld(radiusM, radiusM, -pitDepthM),
    toWorld(-radiusM, radiusM, -pitDepthM),
  ]

  const dataSource = new Cesium.CustomDataSource('underground-cutaway')
  dataSource.entities.add({
    wall: {
      positions: [...topCorners, topCorners[0]],
      minimumHeights: new Array(5).fill(groundHeightM - pitDepthM),
      material: SOIL_WALL_COLOR,
      outline: true,
      outlineColor: Cesium.Color.BLACK.withAlpha(0.35),
    },
  })
  dataSource.entities.add({
    polygon: {
      hierarchy: bottomCorners,
      perPositionHeight: true,
      material: SOIL_FLOOR_COLOR,
    },
  })
  viewer.dataSources.add(dataSource)

  return { dataSource, globePlanes, tilesetPlanes }
}

export function removeCutaway(
  viewer: Cesium.Viewer,
  handle: CutawayHandle | null,
  buildingsTileset: Cesium.Cesium3DTileset | null,
) {
  // An empty collection (rather than `undefined`, which the type doesn't
  // accept) disables clipping — nothing is outside zero planes.
  viewer.scene.globe.clippingPlanes = new Cesium.ClippingPlaneCollection()
  if (buildingsTileset) buildingsTileset.clippingPlanes = new Cesium.ClippingPlaneCollection()
  if (handle) viewer.dataSources.remove(handle.dataSource, true)
}
