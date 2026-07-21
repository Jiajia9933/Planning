import type { FeatureCollection, Geometry } from 'geojson'

export type BoundsBox = [[number, number], [number, number]]

function walkCoordinates(coords: unknown, acc: { minLng: number; minLat: number; maxLng: number; maxLat: number }) {
  if (!Array.isArray(coords)) return
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const [lng, lat] = coords as [number, number]
    acc.minLng = Math.min(acc.minLng, lng)
    acc.maxLng = Math.max(acc.maxLng, lng)
    acc.minLat = Math.min(acc.minLat, lat)
    acc.maxLat = Math.max(acc.maxLat, lat)
    return
  }
  for (const c of coords) walkCoordinates(c, acc)
}

/**
 * Bounding box of any GeoJSON FeatureCollection, regardless of geometry type
 * (LineString, Polygon, MultiPolygon, ...) — used to frame the map/3D view
 * on whatever real data is present, instead of a hardcoded default location.
 */
export function featureCollectionBounds(
  fc: FeatureCollection<Geometry, unknown> | null | undefined,
  paddingRatio = 0.15,
): BoundsBox | null {
  if (!fc || fc.features.length === 0) return null
  const acc = { minLng: Infinity, minLat: Infinity, maxLng: -Infinity, maxLat: -Infinity }
  for (const feature of fc.features) {
    if ('coordinates' in feature.geometry) walkCoordinates(feature.geometry.coordinates, acc)
  }
  if (!Number.isFinite(acc.minLng)) return null
  const padLng = (acc.maxLng - acc.minLng) * paddingRatio + 0.0004
  const padLat = (acc.maxLat - acc.minLat) * paddingRatio + 0.0004
  return [
    [acc.minLng - padLng, acc.minLat - padLat],
    [acc.maxLng + padLng, acc.maxLat + padLat],
  ]
}
