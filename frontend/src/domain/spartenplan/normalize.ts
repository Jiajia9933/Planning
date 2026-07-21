import type { FeatureCollection, LineString } from 'geojson'
import type { UtilityType } from '../../types/hdd'
import type { LayerAssignment, SpartenplanImportResult } from './types'

const TYPE_KEYWORDS: [RegExp, UtilityType][] = [
  [/strom|elektr|power/i, 'strom'],
  [/gas/i, 'gas'],
  [/wasser|trink/i, 'wasser'],
  [/fernw(ä|ae)rme|heiz/i, 'fernwaerme'],
  [/tele|^tk\b|kabel|glasfaser/i, 'telekommunikation'],
  [/abwasser|kanal|schmutzwasser/i, 'abwasser'],
]

/** Suggests a UtilityType from a layer/attribute name — a starting point, never trusted silently. */
export function guessUtilityType(layerOrGroupName: string): UtilityType | null {
  for (const [pattern, type] of TYPE_KEYWORDS) {
    if (pattern.test(layerOrGroupName)) return type
  }
  return null
}

/** Applies the user's per-layer type assignments, producing the same shape mockGeometry.ts's utility builder returns. */
export function buildUploadedFeatureCollection(
  result: SpartenplanImportResult,
  assignments: Record<string, LayerAssignment>,
): FeatureCollection<LineString, { type: UtilityType }> {
  const features = result.rawFeatures.flatMap((feature) => {
    const layerId = feature.properties.__layerId as string
    const assignment = assignments[layerId]
    if (!assignment || assignment === 'ignore') return []
    return [
      {
        type: 'Feature' as const,
        properties: { type: assignment },
        geometry: feature.geometry,
      },
    ]
  })

  return { type: 'FeatureCollection', features }
}
