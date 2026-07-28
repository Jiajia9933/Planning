import networkx as nx

from .geo import haversine_distance_m
from .models import GeoPoint, ParcelFeatureCollection, RouteOptimizationResult
from .parcel_crossing import Coord, find_crossed_parcels, point_in_ring

# Dwarfs any real HDD route length (tens to low hundreds of meters) — makes
# a single Dijkstra run prefer fewer parcel crossings over shorter length,
# only trading one for the other when there's truly no path around.
LARGE_PENALTY_M = 100_000.0

# Above this, the visibility graph (crossed parcels' vertices) gets large
# enough that building it stops being worth the wait, and the result is
# unlikely to be a sane route anyway — bail out with a warning instead.
MAX_CROSSED_PARCELS_FOR_OPTIMIZATION = 40

CLEARANCE_M = 1.0
EPSILON_DEG = 1e-9


def _to_coord(p: GeoPoint) -> Coord:
    return (p.lng, p.lat)


def _to_geo_point(c: Coord) -> GeoPoint:
    return GeoPoint(lat=c[1], lng=c[0])


def _extract_outer_rings(parcels: ParcelFeatureCollection, indices: set[int]) -> list[list[Coord]]:
    rings: list[list[Coord]] = []
    for i, feature in enumerate(parcels.features):
        if i not in indices:
            continue
        if feature.geometry.type == "Polygon":
            rings.append([tuple(pt) for pt in feature.geometry.coordinates[0]])
        else:
            for polygon in feature.geometry.coordinates:
                rings.append([tuple(pt) for pt in polygon[0]])
    return rings


def _is_same_point(p: Coord, q: Coord) -> bool:
    return abs(p[0] - q[0]) < EPSILON_DEG and abs(p[1] - q[1]) < EPSILON_DEG


def _segment_intersection(a1: Coord, a2: Coord, b1: Coord, b2: Coord) -> Coord | None:
    """Direct port of lineIntersection.ts's segmentIntersection — cross-
    product method. Collinear segments (denom ~ 0) return None (no single
    intersection point) rather than the overlap segment shapely would give,
    which matters below: an edge walking along one of the ring's own sides
    (denom==0, both endpoints ARE that side's vertices) must not register as
    crossing it."""
    d1x = a2[0] - a1[0]
    d1y = a2[1] - a1[1]
    d2x = b2[0] - b1[0]
    d2y = b2[1] - b1[1]

    denom = d1x * d2y - d1y * d2x
    if abs(denom) < 1e-15:
        return None

    dx = b1[0] - a1[0]
    dy = b1[1] - a1[1]
    t = (dx * d2y - dy * d2x) / denom
    u = (dx * d1y - dy * d1x) / denom

    if t < 0 or t > 1 or u < 0 or u > 1:
        return None

    return (a1[0] + t * d1x, a1[1] + t * d1y)


def _edge_crosses_ring_boundary(a: Coord, b: Coord, ring: list[Coord]) -> bool:
    """Whether a-b genuinely cuts through the ring's boundary strictly
    between a and b — touches landing exactly on a or b don't count, since
    every graph node here *is* a parcel vertex and an edge legitimately
    ending at a corner would otherwise always register as cutting through
    that corner's two ring edges."""
    for i in range(len(ring) - 1):
        hit = _segment_intersection(a, b, ring[i], ring[i + 1])
        if hit is not None and not (_is_same_point(hit, a) or _is_same_point(hit, b)):
            return True
    return False


def _nudge_away_from_ring(point: Coord, ring: list[Coord], margin_m: float) -> Coord:
    """Nudges a chosen parcel-corner waypoint a small distance directly away
    from that parcel's centroid (mean of its vertices) — routing exactly
    through a corner leaves the path sitting precisely on the boundary, which
    find_crossed_parcels can't reliably tell apart from actually crossing
    it."""
    verts = ring[:-1]
    cx = sum(v[0] for v in verts) / len(verts)
    cy = sum(v[1] for v in verts) / len(verts)
    dx = point[0] - cx
    dy = point[1] - cy
    mag = (dx * dx + dy * dy) ** 0.5
    if mag < 1e-12:
        return point
    margin_deg = margin_m / 111_320
    return (point[0] + (dx / mag) * margin_deg, point[1] + (dy / mag) * margin_deg)


def _edge_weight(a: Coord, b: Coord, rings: list[list[Coord]]) -> float:
    """Distance plus a heavy penalty for every crossed-parcel ring this
    edge's interior passes through — the midpoint check catches
    corner-to-corner diagonals that cut through a convex parcel without
    crossing any single ring edge."""
    dist_m = haversine_distance_m((a[1], a[0]), (b[1], b[0]))
    midpoint: Coord = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    crossings = 0
    for ring in rings:
        if _edge_crosses_ring_boundary(a, b, ring) or point_in_ring(midpoint, ring):
            crossings += 1
    return dist_m + crossings * LARGE_PENALTY_M


def optimize_route(
    start: GeoPoint, end: GeoPoint, parcels: ParcelFeatureCollection | None
) -> RouteOptimizationResult:
    """Proposes waypoints between start and end that avoid crossing
    Flurstücke where possible, without adding needless length: a visibility
    graph over crossed parcels' vertices, shortest-pathed with a
    per-crossing penalty so fewer crossings always wins over shorter length
    unless there's truly no way around. Bend-radius/deflection-angle
    validity of the result is handled separately (smoothSharpBends, still
    TS-side) — this only cares about avoiding parcels."""
    if parcels is None or len(parcels.features) == 0:
        return RouteOptimizationResult(waypoints=[], crossed_parcel_count=0, warnings=[])

    straight_coords = [_to_coord(start), _to_coord(end)]
    baseline_crossed = find_crossed_parcels(straight_coords, parcels)
    if len(baseline_crossed) == 0:
        return RouteOptimizationResult(waypoints=[], crossed_parcel_count=0, warnings=[])
    if len(baseline_crossed) > MAX_CROSSED_PARCELS_FOR_OPTIMIZATION:
        return RouteOptimizationResult(
            waypoints=[],
            crossed_parcel_count=len(baseline_crossed),
            warnings=[
                f"Zu viele betroffene Flurstücke ({len(baseline_crossed)}) für automatische "
                "Optimierung — Route bitte manuell anpassen."
            ],
        )

    crossed_indices = {c.index for c in baseline_crossed}
    rings = _extract_outer_rings(parcels, crossed_indices)

    # Each node knows which ring (if any) it came from, so the chosen path's
    # corner waypoints can be nudged away from *their own* parcel afterward —
    # start/end (ring: None) are the user's fixed points, never nudged.
    nodes: list[tuple[Coord, list[Coord] | None]] = [(_to_coord(start), None)]
    for ring in rings:
        for vertex in ring[:-1]:
            nodes.append((vertex, ring))
    nodes.append((_to_coord(end), None))

    n = len(nodes)
    graph = nx.Graph()
    graph.add_nodes_from(range(n))
    for i in range(n):
        for j in range(i + 1, n):
            graph.add_edge(i, j, weight=_edge_weight(nodes[i][0], nodes[j][0], rings))

    path_indices = nx.dijkstra_path(graph, 0, n - 1, weight="weight")

    path_coords: list[Coord] = []
    for idx in path_indices:
        coord, ring = nodes[idx]
        path_coords.append(_nudge_away_from_ring(coord, ring, CLEARANCE_M) if ring is not None else coord)

    return RouteOptimizationResult(
        waypoints=[_to_geo_point(c) for c in path_coords[1:-1]],
        crossed_parcel_count=len(find_crossed_parcels(path_coords, parcels)),
        warnings=[],
    )
