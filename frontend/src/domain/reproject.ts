import proj4 from 'proj4'
import type { Feature } from 'geojson'

export interface CrsOption {
  code: string
  label: string
}

/** Kept small and Germany-specific — not a general-purpose worldwide CRS picker, just the two zones real German cadastral/utility exports actually come in. */
export const CRS_OPTIONS: CrsOption[] = [
  { code: 'EPSG:25832', label: 'ETRS89 / UTM Zone 32N (25832)' },
  { code: 'EPSG:25833', label: 'ETRS89 / UTM Zone 33N (25833)' },
]

const PROJ4_DEFS: Record<string, string> = {
  'EPSG:25832': '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  'EPSG:25833': '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
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

/**
 * True when every coordinate in `features` already looks like real lng/lat
 * — the cheap, reliable way to tell "shpjs reprojected this via a .prj (or
 * it was already WGS84)" apart from "no .prj, these are still raw projected
 * coordinates" (UTM eastings/northings are in the hundreds of
 * thousands/millions, wildly outside valid lng/lat range).
 */
export function isValidWgs84(features: Feature[]): boolean {
  return features.every(
    (f) => !('coordinates' in f.geometry) || everyCoordinate(f.geometry.coordinates, isValidLngLat),
  )
}

function transformCoordinates(coords: unknown, code: string): unknown {
  if (!Array.isArray(coords)) return coords
  if (typeof coords[0] === 'number') {
    const [x, y] = coords as [number, number]
    return proj4(code, 'WGS84', [x, y])
  }
  return coords.map((c) => transformCoordinates(c, code))
}

/** Reprojects every feature's geometry from `code` to WGS84 — used identically for Spartenplan's flat LineString features and Flurstücke's Polygon/MultiPolygon features, since both are just plain Feature arrays. */
export function reprojectFeatures<F extends Feature>(features: F[], code: string): F[] {
  if (!PROJ4_DEFS[code]) throw new Error(`Unbekanntes Koordinatensystem: ${code}`)
  if (!proj4.defs(code)) proj4.defs(code, PROJ4_DEFS[code])

  return features.map((f) => {
    if (!('coordinates' in f.geometry)) return f
    return {
      ...f,
      geometry: { ...f.geometry, coordinates: transformCoordinates(f.geometry.coordinates, code) },
    }
  }) as F[]
}
