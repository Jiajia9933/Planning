import * as Cesium from 'cesium'
import { buildDrillRouteFeature, buildUtilityLinesFeatureCollection } from '../../domain/mockGeometry'
import { utilityDepthsM } from '../../domain/utilityDepths'
import { colors, utilityColors } from '../../theme/tokens'
import { mockUtilityLayers } from '../../data/mockPlanning'
import type { GeoPoint, ProfileSample, UtilityCrossing } from '../../types/hdd'

const PIPE_RADIUS_M = 0.35
const DRILL_RADIUS_M = 0.5

function circleShape(radiusM: number, segments = 16): Cesium.Cartesian2[] {
  const points: Cesium.Cartesian2[] = []
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Cesium.Math.TWO_PI
    points.push(new Cesium.Cartesian2(Math.cos(angle) * radiusM, Math.sin(angle) * radiusM))
  }
  return points
}

const PIPE_SHAPE = circleShape(PIPE_RADIUS_M)
const DRILL_SHAPE = circleShape(DRILL_RADIUS_M)

/**
 * Rebuilds the Spartenplan pipes, the drill-path tube and the collision
 * markers as Cesium entities. Called wholesale on every relevant state
 * change — the entity count here is small enough that a full rebuild is
 * simpler and cheap enough vs. diffing.
 *
 * `groundHeightM` is the real terrain elevation at the project site (0 when
 * using the flat ellipsoid fallback) — see useGroundHeight for why every
 * height below is `groundHeightM - depth` rather than just `-depth`.
 */
export function rebuildSceneEntities(
  viewer: Cesium.Viewer,
  startPoint: GeoPoint,
  endPoint: GeoPoint,
  profile: ProfileSample[],
  conflicts: UtilityCrossing[],
  groundHeightM: number,
) {
  viewer.entities.removeAll()

  const utilityTypes = mockUtilityLayers.map((l) => l.type)
  const utilities = buildUtilityLinesFeatureCollection(startPoint, endPoint, utilityTypes)
  for (const feature of utilities.features) {
    const height = groundHeightM - utilityDepthsM[feature.properties.type]
    const [[lng1, lat1], [lng2, lat2]] = feature.geometry.coordinates as [number, number][]
    viewer.entities.add({
      polylineVolume: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([lng1, lat1, height, lng2, lat2, height]),
        shape: PIPE_SHAPE,
        material: Cesium.Color.fromCssColorString(utilityColors[feature.properties.type]),
      },
    })
  }

  const routeFeature = buildDrillRouteFeature(startPoint, endPoint)
  const routeCoords = routeFeature.geometry.coordinates as [number, number][]
  const flatPositions: number[] = []
  routeCoords.forEach(([lng, lat], i) => {
    const sample = profile[i]
    const depth = sample ? sample.terrainHeightM - sample.drillPathHeightM : 0
    flatPositions.push(lng, lat, groundHeightM - depth)
  })
  viewer.entities.add({
    polylineVolume: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(flatPositions),
      shape: DRILL_SHAPE,
      material: Cesium.Color.fromCssColorString(colors.accentOrange),
    },
  })

  viewer.entities.add(surfaceMarker(startPoint, 'Start', colors.accentGreen, groundHeightM))
  viewer.entities.add(surfaceMarker(endPoint, 'Ziel', colors.accentRed, groundHeightM))

  for (const c of conflicts) {
    const color = c.isConflict ? colors.accentRed : utilityColors[c.type]
    const position = Cesium.Cartesian3.fromDegrees(c.point.lng, c.point.lat, groundHeightM - c.drillDepthM)
    viewer.entities.add({
      position,
      point: {
        pixelSize: c.isConflict ? 14 : 9,
        color: Cesium.Color.fromCssColorString(color),
        outlineColor: Cesium.Color.fromCssColorString(colors.bgApp),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: c.isConflict
        ? {
            text: '⚠',
            font: '16px sans-serif',
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -14),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          }
        : undefined,
    })
    viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          c.point.lng,
          c.point.lat,
          groundHeightM,
          c.point.lng,
          c.point.lat,
          groundHeightM - c.drillDepthM,
        ]),
        width: 1,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString(color).withAlpha(0.6),
        }),
      },
    })
  }
}

function surfaceMarker(point: GeoPoint, text: string, color: string, groundHeightM: number): Cesium.Entity.ConstructorOptions {
  return {
    position: Cesium.Cartesian3.fromDegrees(point.lng, point.lat, groundHeightM),
    point: {
      pixelSize: 10,
      color: Cesium.Color.fromCssColorString(color),
      outlineColor: Cesium.Color.fromCssColorString(colors.bgApp),
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text,
      font: '600 13px sans-serif',
      fillColor: Cesium.Color.WHITE,
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString(color),
      backgroundPadding: new Cesium.Cartesian2(6, 3),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -12),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  }
}
