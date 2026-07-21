import * as Cesium from 'cesium'
import { haversineDistanceM } from '@hdd-planner/domain'
import type { GeoPoint } from '@hdd-planner/domain'
import type { BoundsBox } from '../../domain/geoBounds'

/** Bounding sphere + heading used to frame the project in an oblique 3D view. */
export function computeCameraTarget(
  startPoint: GeoPoint,
  endPoint: GeoPoint,
  maxDepthM: number,
  groundHeightM = 0,
) {
  const centerLat = (startPoint.lat + endPoint.lat) / 2
  const centerLng = (startPoint.lng + endPoint.lng) / 2
  const distanceM = haversineDistanceM(startPoint, endPoint)
  const radius = Math.max(distanceM / 2 + 25, maxDepthM * 2.5, 45)

  const lat1 = (startPoint.lat * Math.PI) / 180
  const lat2 = (endPoint.lat * Math.PI) / 180
  const dLng = ((endPoint.lng - startPoint.lng) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  const bearing = Math.atan2(y, x)

  return {
    center: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, groundHeightM - maxDepthM / 2),
    radius,
    heading: bearing,
  }
}

/** Bounding sphere framing an arbitrary lng/lat box — used to fly to real uploaded data on first load. */
export function boundingSphereFromBounds(bounds: BoundsBox, groundHeightM = 0): Cesium.BoundingSphere {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds
  const centerLng = (minLng + maxLng) / 2
  const centerLat = (minLat + maxLat) / 2
  const center = Cesium.Cartesian3.fromDegrees(centerLng, centerLat, groundHeightM)
  const corner1 = Cesium.Cartesian3.fromDegrees(minLng, minLat, groundHeightM)
  const corner2 = Cesium.Cartesian3.fromDegrees(maxLng, maxLat, groundHeightM)
  const radius = Math.max(
    Cesium.Cartesian3.distance(center, corner1),
    Cesium.Cartesian3.distance(center, corner2),
    45,
  )
  return new Cesium.BoundingSphere(center, radius)
}
