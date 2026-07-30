import type { ParcelFeatureCollection } from '@hdd-planner/domain'
import { pool } from '../db/pool'

// A route's bbox is always small (see gebaeude.ts's MAX_BBOX_SPAN_DEG check),
// so this is a generous ceiling, not a routine limit — it exists only to
// bound a pathological query, same spirit as fetchExternalGebaeude's
// FETCH_LIMIT.
const QUERY_LIMIT = 5000

/**
 * Reads from the locally imported gebaeude_cache table (see
 * db/importGebaeudeCache.ts) instead of a live external API — used for
 * German states whose building-footprint data isn't available as a
 * queryable API the way LGL-BW's is (see gebaeudeExternalSource.ts),
 * only as a one-off bulk import. `source` scopes the query to features
 * from a particular imported dataset (e.g. "bayern-hausumringe-oberbayern"),
 * since more than one may eventually share this table.
 */
export async function queryGebaeudeCache(
  bbox: [number, number, number, number],
  source: string,
): Promise<ParcelFeatureCollection> {
  const [minLng, minLat, maxLng, maxLat] = bbox
  const { rows } = await pool.query<{ label: string | null; geometry: unknown }>(
    `SELECT label, geometry FROM gebaeude_cache
     WHERE source = $1 AND min_lng <= $4 AND max_lng >= $2 AND min_lat <= $5 AND max_lat >= $3
     LIMIT $6`,
    [source, minLng, minLat, maxLng, maxLat, QUERY_LIMIT],
  )

  return {
    type: 'FeatureCollection',
    features: rows.map((row) => ({
      type: 'Feature',
      geometry: row.geometry as ParcelFeatureCollection['features'][number]['geometry'],
      properties: { label: row.label ?? undefined },
    })),
  }
}
