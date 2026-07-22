import { segmentIntersection } from '../lineIntersection'
import type { Coord } from '../lineIntersection'
import type { ParcelFeatureCollection, CrossedParcel } from './types'

/** Ray-casting point-in-polygon test against a single ring. */
export function pointInRing(point: Coord, ring: Coord[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects = yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** `rings[0]` is the outer boundary, any further rings are holes. */
function pointInPolygon(point: Coord, rings: Coord[][]): boolean {
  if (rings.length === 0 || !pointInRing(point, rings[0])) return false
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(point, rings[i])) return false
  }
  return true
}

export function segmentCrossesRing(a1: Coord, a2: Coord, ring: Coord[]): boolean {
  for (let i = 0; i < ring.length - 1; i++) {
    if (segmentIntersection(a1, a2, ring[i], ring[i + 1])) return true
  }
  return false
}

function routeCrossesPolygon(routeCoords: Coord[], rings: Coord[][]): boolean {
  if (routeCoords.some((point) => pointInPolygon(point, rings))) return true
  for (let i = 0; i < routeCoords.length - 1; i++) {
    if (rings.some((ring) => segmentCrossesRing(routeCoords[i], routeCoords[i + 1], ring))) return true
  }
  return false
}

/**
 * Which uploaded parcels the drill route passes through — a parcel counts as
 * crossed if any route vertex falls inside it or any route segment crosses
 * one of its boundary edges. Every extra parcel crossed is another property
 * owner whose consent is needed — this is what lets a Bauleiter see the cost
 * of a routing choice.
 */
export function findCrossedParcels(routeCoords: Coord[], parcels: ParcelFeatureCollection): CrossedParcel[] {
  const crossed: CrossedParcel[] = []
  parcels.features.forEach((feature, index) => {
    const polygonRingSets: Coord[][][] =
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates as Coord[][]]
        : (feature.geometry.coordinates as Coord[][][])
    const crossesAny = polygonRingSets.some((rings) => routeCrossesPolygon(routeCoords, rings))
    if (crossesAny) {
      crossed.push({ index, label: feature.properties.label ?? `Flurstück ${index + 1}` })
    }
  })
  return crossed
}
