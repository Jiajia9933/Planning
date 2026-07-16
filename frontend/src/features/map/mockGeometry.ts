import type { Feature, FeatureCollection, LineString } from 'geojson'
import type { GeoPoint, UtilityType } from '../../types/hdd'

/**
 * Quadratic-bezier bow between two points so the drill route reads as a
 * planned curve rather than a straight cut — mirrors how HDD crossings are
 * actually laid out. Replaced by the real geometry engine's output in a
 * later milestone; the GeoJSON shape consumed by the map stays the same.
 */
export function buildDrillRouteFeature(start: GeoPoint, end: GeoPoint): Feature<LineString> {
  const steps = 32
  const midLat = (start.lat + end.lat) / 2
  const midLng = (start.lng + end.lng) / 2
  const dLat = end.lat - start.lat
  const dLng = end.lng - start.lng
  const bow = 0.4
  const controlLat = midLat + dLng * bow
  const controlLng = midLng - dLat * bow

  const coordinates: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const lat = (1 - t) ** 2 * start.lat + 2 * (1 - t) * t * controlLat + t ** 2 * end.lat
    const lng = (1 - t) ** 2 * start.lng + 2 * (1 - t) * t * controlLng + t ** 2 * end.lng
    coordinates.push([lng, lat])
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates },
  }
}

/**
 * Synthetic utility crossings spanning the project's bounding box, standing
 * in for a real cadastral/utility GIS feed (see project doc §5.4/§5.5,
 * "Future: Load automatically from GIS services").
 */
export function buildUtilityLinesFeatureCollection(
  start: GeoPoint,
  end: GeoPoint,
  types: UtilityType[],
): FeatureCollection<LineString, { type: UtilityType }> {
  const padLat = Math.abs(end.lat - start.lat) * 1.6 + 0.0006
  const padLng = Math.abs(end.lng - start.lng) * 0.8 + 0.0006
  const centerLat = (start.lat + end.lat) / 2
  const centerLng = (start.lng + end.lng) / 2

  const features: Feature<LineString, { type: UtilityType }>[] = types.map((type, i) => {
    const t = types.length <= 1 ? 0.5 : i / (types.length - 1)
    const offset = (t - 0.5) * 2 * padLat
    const skew = ((i % 3) - 1) * padLng * 0.35
    return {
      type: 'Feature',
      properties: { type },
      geometry: {
        type: 'LineString',
        coordinates: [
          [centerLng - padLng * 1.4 + skew, centerLat + offset],
          [centerLng + padLng * 1.4 - skew, centerLat + offset * 0.4],
        ],
      },
    }
  })

  return { type: 'FeatureCollection', features }
}

/** Synthetic parcel grid ("Flurstücksgrenzen") anchored to the project area. */
export function buildParcelGridFeatureCollection(
  start: GeoPoint,
  end: GeoPoint,
): FeatureCollection<LineString> {
  const padLat = Math.abs(end.lat - start.lat) * 2 + 0.0012
  const padLng = Math.abs(end.lng - start.lng) * 1.2 + 0.0012
  const centerLat = (start.lat + end.lat) / 2
  const centerLng = (start.lng + end.lng) / 2
  const minLat = centerLat - padLat
  const maxLat = centerLat + padLat
  const minLng = centerLng - padLng
  const maxLng = centerLng + padLng

  const features: Feature<LineString>[] = []
  const divisions = 5
  for (let i = 1; i < divisions; i++) {
    const lng = minLng + ((maxLng - minLng) * i) / divisions
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [lng, minLat],
          [lng, maxLat],
        ],
      },
    })
    const lat = minLat + ((maxLat - minLat) * i) / divisions
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [minLng, lat],
          [maxLng, lat],
        ],
      },
    })
  }

  return { type: 'FeatureCollection', features }
}
