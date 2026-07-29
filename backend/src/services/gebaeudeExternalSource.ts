import type { ParcelFeatureCollection } from '@hdd-planner/domain'

const LGL_BW_ITEMS_URL = 'https://ogcapi.lgl-bw.de/beta/pygeoapi/collections/gebaeude/items'

// Comfortably covers a bbox around a single HDD route (typically tens to a
// few hundred meters) — this is a local per-route lookup, not a bulk export,
// so there's no pagination follow-up if a bbox genuinely has more buildings
// than this: avoidance is a best-effort convenience, and
// MAX_CROSSED_PARCELS_FOR_OPTIMIZATION already caps the routing algorithm
// itself well below this figure.
const FETCH_LIMIT = 2000

interface LglBwFeature {
  type: 'Feature'
  geometry: { type: string; coordinates: unknown }
  properties: {
    gebaeudefunktion_name?: string
    eigenname?: string | null
  }
}

interface LglBwFeatureCollection {
  type: 'FeatureCollection'
  features: LglBwFeature[]
}

/**
 * Live Baden-Württemberg building footprints (Gebäude) from LGL-BW's public
 * OGC API Features endpoint (https://ogcapi.lgl-bw.de) — a physical-obstacle
 * avoidance source (can't drill through a building foundation), reusing the
 * same ParcelFeatureCollection shape and avoidance pipeline as manually
 * uploaded Flurstücke since the routing algorithm treats any polygon the
 * same way regardless of what it represents. Coordinates come back as
 * WGS84 (CRS84), matching this project's convention already — no
 * reprojection needed. Only Baden-Württemberg is covered so far; other
 * German states would need their own fetcher added here alongside this
 * one, not a rewrite of this one.
 */
export async function fetchExternalGebaeude(bbox: [number, number, number, number]): Promise<ParcelFeatureCollection> {
  const url = `${LGL_BW_ITEMS_URL}?f=json&limit=${FETCH_LIMIT}&bbox=${bbox.join(',')}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`LGL-BW Gebäude service responded with ${res.status}`)
  }
  const data = (await res.json()) as LglBwFeatureCollection

  return {
    type: 'FeatureCollection',
    features: data.features
      .filter((f): f is LglBwFeature & { geometry: { type: 'Polygon' | 'MultiPolygon' } } =>
        f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon',
      )
      .map((f) => ({
        type: 'Feature',
        geometry: f.geometry as ParcelFeatureCollection['features'][number]['geometry'],
        properties: {
          label: f.properties.eigenname ?? f.properties.gebaeudefunktion_name,
        },
      })),
  }
}
