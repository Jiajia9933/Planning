import type { FeatureCollection, LineString } from 'geojson'
import { buildUtilityLinesFeatureCollection } from '../mockGeometry'
import { defaultUtilityTypes } from '../defaults'
import type { GeoPoint, UtilityType } from '../types'

/**
 * Single point every consumer (map, 3D view, conflict detection) calls
 * instead of deciding for itself whether real Spartenplan data exists.
 * Falls back to the synthetic demo geometry only when nothing was uploaded.
 */
export function getUtilityFeatureCollection(
  params: { startPoint: GeoPoint; endPoint: GeoPoint },
  uploaded: FeatureCollection<LineString, { type: UtilityType }> | null,
): FeatureCollection<LineString, { type: UtilityType }> {
  if (uploaded) return uploaded
  return buildUtilityLinesFeatureCollection(params.startPoint, params.endPoint, defaultUtilityTypes)
}
