import shp from 'shpjs'
import type { Feature, FeatureCollection, Geometry, LineString } from 'geojson'
import type { ImportedLayerInfo, SpartenplanImportResult } from './types'

/** DBF attribute keys, in priority order, that commonly carry a utility category. */
const GROUPING_ATTRIBUTE_CANDIDATES = ['SPARTE', 'TYP', 'TYPE', 'ART', 'KATEGORIE', 'LAYER']

function toLineStringFeatures(
  feature: Feature<Geometry, Record<string, unknown>>,
): Feature<LineString, Record<string, unknown>>[] {
  const { geometry, properties } = feature
  if (geometry.type === 'LineString') {
    return [{ type: 'Feature', properties, geometry }]
  }
  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates.map((coordinates) => ({
      type: 'Feature',
      properties,
      geometry: { type: 'LineString', coordinates },
    }))
  }
  return []
}

function pickGroupKey(properties: Record<string, unknown>, fallback: string): string {
  for (const key of GROUPING_ATTRIBUTE_CANDIDATES) {
    const match = Object.keys(properties).find((k) => k.toUpperCase() === key)
    const value = match ? properties[match] : undefined
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return fallback
}

/**
 * Parses a zipped Shapefile (.shp/.dbf/.shx, optionally .prj) into normalized
 * LineString features grouped into layers the user assigns a UtilityType to.
 * shpjs reprojects to WGS84 automatically when a .prj is present.
 */
export async function parseShapefileZip(file: File): Promise<SpartenplanImportResult> {
  const buffer = await file.arrayBuffer()
  const parsed = await shp(buffer)
  const collections: FeatureCollection<Geometry, Record<string, unknown>>[] = Array.isArray(parsed)
    ? parsed
    : [parsed]

  const multipleSourceLayers = collections.length > 1
  const rawFeatures: Feature<LineString, Record<string, unknown>>[] = []
  const featureCountByGroup = new Map<string, number>()

  for (const collection of collections) {
    const sourceName = (collection as { fileName?: string }).fileName ?? 'Spartenplan'
    for (const feature of collection.features) {
      for (const lineFeature of toLineStringFeatures(feature)) {
        const groupKey = multipleSourceLayers
          ? sourceName
          : pickGroupKey(lineFeature.properties, 'Unbekannt')
        lineFeature.properties = { ...lineFeature.properties, __layerId: groupKey }
        rawFeatures.push(lineFeature)
        featureCountByGroup.set(groupKey, (featureCountByGroup.get(groupKey) ?? 0) + 1)
      }
    }
  }

  const layers: ImportedLayerInfo[] = Array.from(featureCountByGroup.entries()).map(
    ([id, featureCount]) => ({ id, sourceName: id, featureCount }),
  )

  return { rawFeatures, layers }
}
