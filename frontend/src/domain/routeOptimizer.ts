import { haversineDistanceM, segmentIntersection } from '@hdd-planner/domain'
import type { Coord } from '@hdd-planner/domain'
import type { GeoPoint } from '../types/hdd'
import type { ParcelFeatureCollection } from './flurstuecke/shapefileImport'
import { findCrossedParcels, pointInRing } from './parcelCrossing'

export interface RouteOptimizationResult {
  waypoints: GeoPoint[]
  crossedParcelCount: number
  warnings: string[]
}

// Dwarfs any real HDD route length (tens to low hundreds of meters) — makes
// a single Dijkstra run prefer fewer parcel crossings over shorter length,
// only trading one for the other when there's truly no path around.
const LARGE_PENALTY_M = 100_000

// Above this, the visibility graph (crossed parcels' vertices) gets large
// enough that building it stops being worth the wait, and the result is
// unlikely to be a sane route anyway — bail out with a warning instead.
const MAX_CROSSED_PARCELS_FOR_OPTIMIZATION = 40

const toCoord = (p: GeoPoint): Coord => [p.lng, p.lat]
const toGeoPoint = (c: Coord): GeoPoint => ({ lat: c[1], lng: c[0] })

function extractOuterRings(parcels: ParcelFeatureCollection, indices: Set<number>): Coord[][] {
  const rings: Coord[][] = []
  parcels.features.forEach((feature, i) => {
    if (!indices.has(i)) return
    if (feature.geometry.type === 'Polygon') {
      rings.push(feature.geometry.coordinates[0] as Coord[])
    } else {
      for (const polygon of feature.geometry.coordinates) rings.push(polygon[0] as Coord[])
    }
  })
  return rings
}

const EPSILON_DEG = 1e-9
const isSamePoint = (p: Coord, q: Coord) => Math.abs(p[0] - q[0]) < EPSILON_DEG && Math.abs(p[1] - q[1]) < EPSILON_DEG

/**
 * Whether segment a-b genuinely cuts through the ring's boundary at some
 * point strictly between a and b — unlike `segmentCrossesRing` (used for
 * real route-vs-parcel crossing detection elsewhere, left untouched), this
 * ignores intersections that land exactly on a or b themselves. It has to:
 * every graph node here *is* a parcel vertex, so an edge legitimately
 * ending at a corner would otherwise always "intersect" that corner's two
 * ring edges and be wrongly treated as cutting through the parcel.
 */
function edgeCrossesRingBoundary(a: Coord, b: Coord, ring: Coord[]): boolean {
  for (let i = 0; i < ring.length - 1; i++) {
    const hit = segmentIntersection(a, b, ring[i], ring[i + 1])
    if (hit && !isSamePoint(hit.point, a) && !isSamePoint(hit.point, b)) return true
  }
  return false
}

/**
 * Nudges a chosen parcel-corner waypoint a small distance directly away
 * from that parcel's centroid — routing exactly through a corner leaves the
 * path sitting precisely on the boundary, which `findCrossedParcels` (a
 * general-purpose detector never designed for exact-boundary routes) can't
 * reliably tell apart from actually crossing it. This is a simplification:
 * in a dense grid of edge-to-edge adjacent parcels, nudging away from one
 * parcel could in principle nick a neighboring one that shares the same
 * corner — the final `findCrossedParcels` check below still catches that
 * honestly rather than hiding it.
 */
function nudgeAwayFromRing(point: Coord, ring: Coord[], marginM: number): Coord {
  const [cx, cy] = ring
    .slice(0, -1)
    .reduce(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0])
    .map((sum) => sum / (ring.length - 1)) as Coord
  const dx = point[0] - cx
  const dy = point[1] - cy
  const mag = Math.hypot(dx, dy)
  if (mag < 1e-12) return point
  const marginDeg = marginM / 111_320
  return [point[0] + (dx / mag) * marginDeg, point[1] + (dy / mag) * marginDeg]
}

/** Distance plus a heavy penalty for every crossed-parcel ring this edge's interior passes through — the midpoint check catches corner-to-corner diagonals that cut through a convex parcel without crossing any single ring edge. */
function edgeWeight(a: Coord, b: Coord, rings: Coord[][]): number {
  const distM = haversineDistanceM(toGeoPoint(a), toGeoPoint(b))
  const midpoint: Coord = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  let crossings = 0
  for (const ring of rings) {
    if (edgeCrossesRingBoundary(a, b, ring) || pointInRing(midpoint, ring)) crossings++
  }
  return distM + crossings * LARGE_PENALTY_M
}

/** Plain O(V²) Dijkstra — realistic node counts (crossed-parcel vertices) are in the dozens, no need for a heap. Graph is complete, so a path always exists. */
function shortestPath(weights: number[][]): number[] {
  const n = weights.length
  const dist = new Array(n).fill(Infinity)
  const prev = new Array(n).fill(-1)
  const visited = new Array(n).fill(false)
  dist[0] = 0

  for (let iter = 0; iter < n; iter++) {
    let u = -1
    let best = Infinity
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[i] < best) {
        best = dist[i]
        u = i
      }
    }
    if (u === -1) break
    visited[u] = true
    for (let v = 0; v < n; v++) {
      if (visited[v] || v === u) continue
      const alt = dist[u] + weights[u][v]
      if (alt < dist[v]) {
        dist[v] = alt
        prev[v] = u
      }
    }
  }

  const path: number[] = []
  let cur = n - 1
  while (cur !== -1) {
    path.unshift(cur)
    cur = prev[cur]
  }
  return path
}

/** Angle between the incoming and outgoing direction vectors at `curr` — 0 for a straight continuation, up to π for a full reversal. Same locally-planar lng/lat simplification `segmentIntersection` already uses at this scale. */
function deflectionAngleRad(prev: GeoPoint, curr: GeoPoint, next: GeoPoint): number {
  const v1 = { x: curr.lng - prev.lng, y: curr.lat - prev.lat }
  const v2 = { x: next.lng - curr.lng, y: next.lat - curr.lat }
  const mag1 = Math.hypot(v1.x, v1.y)
  const mag2 = Math.hypot(v2.x, v2.y)
  if (mag1 === 0 || mag2 === 0) return 0
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2)))
  return Math.acos(cos)
}

/**
 * Flags bends whose inscribed-arc tangent length (`R * tan(Δ/2)`, standard
 * curve-design geometry) doesn't fit within the adjacent segment — a real
 * guarantee would need to generate actual arcs (Dubins-style path
 * planning), which is out of scope; this detects and names the problem for
 * the Bauleiter to fix by hand instead (waypoints are already draggable).
 */
function radiusWarnings(routePoints: GeoPoint[], minDrillRadiusM: number): string[] {
  const warnings: string[] = []
  for (let i = 1; i < routePoints.length - 1; i++) {
    const prev = routePoints[i - 1]
    const curr = routePoints[i]
    const next = routePoints[i + 1]
    const theta = deflectionAngleRad(prev, curr, next)
    if (theta < 1e-6) continue
    const requiredApproachM = minDrillRadiusM * Math.tan(theta / 2)
    const segBeforeM = haversineDistanceM(prev, curr)
    const segAfterM = haversineDistanceM(curr, next)
    if (requiredApproachM > segBeforeM || requiredApproachM > segAfterM) {
      warnings.push(
        `Kurve bei Wegpunkt ${i} ist enger als der minimale Bohrradius (${minDrillRadiusM} m) zulässt — bitte manuell anpassen.`,
      )
    }
  }
  return warnings
}

/**
 * Proposes waypoints between `start` and `end` that avoid crossing
 * Flurstücke where possible, without adding needless length. See the
 * "Route optimieren" plan for the full algorithm rationale: a visibility
 * graph over crossed parcels' vertices, shortest-pathed with a per-crossing
 * penalty so fewer crossings always wins over shorter length unless there's
 * truly no way around.
 */
export function optimizeRoute(
  start: GeoPoint,
  end: GeoPoint,
  parcels: ParcelFeatureCollection | null,
  minDrillRadiusM: number,
): RouteOptimizationResult {
  if (!parcels || parcels.features.length === 0) {
    return { waypoints: [], crossedParcelCount: 0, warnings: [] }
  }

  const straightCoords: Coord[] = [toCoord(start), toCoord(end)]
  const baselineCrossed = findCrossedParcels(straightCoords, parcels)
  if (baselineCrossed.length === 0) {
    return { waypoints: [], crossedParcelCount: 0, warnings: [] }
  }
  if (baselineCrossed.length > MAX_CROSSED_PARCELS_FOR_OPTIMIZATION) {
    return {
      waypoints: [],
      crossedParcelCount: baselineCrossed.length,
      warnings: [
        `Zu viele betroffene Flurstücke (${baselineCrossed.length}) für automatische Optimierung — Route bitte manuell anpassen.`,
      ],
    }
  }

  const crossedIndices = new Set(baselineCrossed.map((c) => c.index))
  const rings = extractOuterRings(parcels, crossedIndices)

  // Each node knows which ring (if any) it came from, so the chosen path's
  // corner waypoints can be nudged away from *their own* parcel afterward —
  // start/end (ring: null) are the user's fixed points, never nudged.
  const nodes: { coord: Coord; ring: Coord[] | null }[] = [{ coord: toCoord(start), ring: null }]
  for (const ring of rings) {
    for (const vertex of ring.slice(0, -1)) nodes.push({ coord: vertex, ring })
  }
  nodes.push({ coord: toCoord(end), ring: null })
  const nodeCoords = nodes.map((node) => node.coord)

  const n = nodeCoords.length
  const weights: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const w = edgeWeight(nodeCoords[i], nodeCoords[j], rings)
      weights[i][j] = w
      weights[j][i] = w
    }
  }

  const pathIndices = shortestPath(weights)
  const CLEARANCE_M = 1
  const pathCoords = pathIndices.map((idx) => {
    const node = nodes[idx]
    return node.ring ? nudgeAwayFromRing(node.coord, node.ring, CLEARANCE_M) : node.coord
  })
  const pathPoints = pathCoords.map(toGeoPoint)

  return {
    waypoints: pathPoints.slice(1, -1),
    crossedParcelCount: findCrossedParcels(pathCoords, parcels).length,
    warnings: radiusWarnings(pathPoints, minDrillRadiusM),
  }
}
