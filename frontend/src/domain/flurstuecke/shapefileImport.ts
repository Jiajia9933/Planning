import shp from 'shpjs'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'

/** DBF attribute keys, in priority order, that commonly identify a parcel. */
const LABEL_ATTRIBUTE_CANDIDATES = ['FLSTNR', 'FLURSTNR', 'NUMMER', 'GEMARKUNG', 'EIGENTUEMER', 'OWNER', 'LABEL']

export type ParcelFeatureCollection = FeatureCollection<Polygon | MultiPolygon, { label?: string }>

function pickLabel(properties: Record<string, unknown>): string | undefined {
  for (const key of LABEL_ATTRIBUTE_CANDIDATES) {
    const match = Object.keys(properties).find((k) => k.toUpperCase() === key)
    const value = match ? properties[match] : undefined
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return undefined
}

function toParcelFeatures(
  feature: Feature<Geometry, Record<string, unknown>>,
): Feature<Polygon | MultiPolygon, { label?: string }>[] {
  const { geometry, properties } = feature
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return []
  return [{ type: 'Feature', properties: { label: pickLabel(properties) }, geometry }]
}

/**
 * Parses a zipped Shapefile of parcel boundaries into normalized Polygon
 * features. Unlike Spartenplan's per-layer type assignment, a parcel needs
 * no categorization — every polygon found is kept as-is.
 */
export async function parseParcelShapefileZip(file: File): Promise<ParcelFeatureCollection> {
  const buffer = await file.arrayBuffer()
  const parsed = await shp(buffer)
  const collections = Array.isArray(parsed) ? parsed : [parsed]
  const features = collections.flatMap((collection) => collection.features.flatMap(toParcelFeatures))
  return { type: 'FeatureCollection', features }
}
