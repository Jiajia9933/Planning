import { readFileSync } from 'node:fs'
import proj4 from 'proj4'
import shp from 'shpjs'
import type { Geometry } from 'geojson'
import { pool } from './pool'

// Bavaria's Hausumringe shapefiles are natively ETRS89 / UTM zone 32N — same
// projection frontend/src/domain/reproject.ts already handles for uploaded
// Flurstücke/Spartenplan, reused here so a one-off import script doesn't need
// its own copy of the datum parameters.
const SOURCE_CRS = 'EPSG:25832'
const SOURCE_CRS_DEF = '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'

// Multi-row INSERTs of this size stay comfortably under Postgres's 65535
// bound-parameter limit (7 columns × 2000 rows = 14000) while keeping the
// number of round trips reasonable for a dataset in the millions of rows.
const BATCH_SIZE = 2000

function transformCoordinates(coords: unknown): unknown {
  if (!Array.isArray(coords)) return coords
  if (typeof coords[0] === 'number') {
    const [x, y] = coords as [number, number]
    return proj4(SOURCE_CRS, 'WGS84', [x, y])
  }
  return coords.map(transformCoordinates)
}

function isValidLngLat(coord: unknown): boolean {
  if (!Array.isArray(coord) || typeof coord[0] !== 'number' || typeof coord[1] !== 'number') return true
  return Math.abs(coord[0]) <= 180 && Math.abs(coord[1]) <= 90
}

function everyCoordinate(coords: unknown, check: (coord: unknown) => boolean): boolean {
  if (!Array.isArray(coords)) return true
  if (typeof coords[0] === 'number') return check(coords)
  return coords.every((c) => everyCoordinate(c, check))
}

// shpjs reprojects to WGS84 itself when the zip's .prj is present and
// recognized (this Hausumringe zip has one) — matches
// frontend/src/domain/reproject.ts's isValidWgs84 check, which exists for
// exactly this reason: UTM eastings/northings are in the hundreds of
// thousands/millions, wildly outside valid lng/lat range, so this is a
// cheap and reliable way to tell "already reprojected" apart from "still
// raw projected coordinates that this script needs to transform itself."
function isAlreadyWgs84(geometry: Geometry): boolean {
  return !('coordinates' in geometry) || everyCoordinate(geometry.coordinates, isValidLngLat)
}

function computeBbox(geometry: Geometry): [number, number, number, number] | null {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  function walk(coords: unknown) {
    if (!Array.isArray(coords)) return
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords as [number, number]
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
      return
    }
    for (const c of coords) walk(c)
  }

  if ('coordinates' in geometry) walk(geometry.coordinates)
  if (!Number.isFinite(minLng)) return null
  return [minLng, minLat, maxLng, maxLat]
}

async function main() {
  const [, , zipPath, source] = process.argv
  if (!zipPath || !source) {
    console.error('Usage: npm run import:gebaeude-cache -- <path-to-shapefile.zip> <source-label>')
    console.error('Example: npm run import:gebaeude-cache -- ./091_Oberbayern_Hausumringe.zip bayern-hausumringe-oberbayern')
    process.exit(1)
  }

  console.log(`Reading ${zipPath}...`)
  const nodeBuffer = readFileSync(zipPath)
  const arrayBuffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength)

  console.log('Parsing shapefile (large files can take a few minutes)...')
  const parsed = await shp(arrayBuffer)
  const collections = Array.isArray(parsed) ? parsed : [parsed]
  const features = collections.flatMap((c) => c.features)
  console.log(`Parsed ${features.length} features.`)

  if (!proj4.defs(SOURCE_CRS)) proj4.defs(SOURCE_CRS, SOURCE_CRS_DEF)

  let inserted = 0
  let skipped = 0
  for (let i = 0; i < features.length; i += BATCH_SIZE) {
    const batch = features.slice(i, i + BATCH_SIZE)
    const rows: { label: string | null; geometry: Geometry; bbox: [number, number, number, number] }[] = []

    for (const feature of batch) {
      if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
        skipped++
        continue
      }
      const reprojected: Geometry = isAlreadyWgs84(feature.geometry)
        ? feature.geometry
        : ({ ...feature.geometry, coordinates: transformCoordinates(feature.geometry.coordinates) } as Geometry)
      const bbox = computeBbox(reprojected)
      if (!bbox) {
        skipped++
        continue
      }
      const ags = feature.properties?.ags
      const label = typeof ags === 'string' || typeof ags === 'number' ? String(ags) : null
      rows.push({ label, geometry: reprojected, bbox })
    }
    if (rows.length === 0) continue

    const values: unknown[] = []
    const placeholders = rows.map((row, idx) => {
      const base = idx * 7
      values.push(source, row.label, JSON.stringify(row.geometry), row.bbox[0], row.bbox[1], row.bbox[2], row.bbox[3])
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`
    })
    await pool.query(
      `INSERT INTO gebaeude_cache (source, label, geometry, min_lng, min_lat, max_lng, max_lat) VALUES ${placeholders.join(', ')}`,
      values,
    )
    inserted += rows.length
    console.log(`Inserted ${inserted} / ${features.length}...`)
  }

  await pool.end()
  console.log(`Done. Inserted ${inserted} rows, skipped ${skipped}, for source "${source}".`)
}

main().catch((err) => {
  console.error('Import failed:', err)
  process.exit(1)
})
