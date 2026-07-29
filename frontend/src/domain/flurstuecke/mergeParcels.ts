import type { ParcelFeatureCollection } from '@hdd-planner/domain'

/**
 * Concatenates manually uploaded Flurstücke with the live external source
 * (see MapPanel's LGL-BW fetch) — no deduplication: the same real-world
 * parcel appearing from both sources is a rare, harmless overlap, not
 * something worth reconciling.
 */
export function mergeParcelCollections(
  a: ParcelFeatureCollection | null,
  b: ParcelFeatureCollection | null,
): ParcelFeatureCollection | null {
  if (!a) return b
  if (!b) return a
  return { type: 'FeatureCollection', features: [...a.features, ...b.features] }
}
