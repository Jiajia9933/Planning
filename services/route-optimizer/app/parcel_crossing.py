from shapely.geometry import LineString, Point, Polygon, MultiPolygon

from .models import ParcelFeature, ParcelFeatureCollection, CrossedParcel

Coord = tuple[float, float]  # (lng, lat) — matches GeoJSON/shapely coordinate order


def feature_geometry(feature: ParcelFeature) -> Polygon | MultiPolygon:
    geom = feature.geometry
    if geom.type == "Polygon":
        rings = geom.coordinates
        return Polygon(rings[0], holes=rings[1:] or None)
    return MultiPolygon([Polygon(rings[0], holes=rings[1:] or None) for rings in geom.coordinates])


def find_crossed_parcels(route_coords: list[Coord], parcels: ParcelFeatureCollection) -> list[CrossedParcel]:
    """A parcel counts as crossed if the route touches it anywhere — vertex
    inside, or a segment crossing its boundary — mirroring conflictDetection's
    TS counterpart. `intersects` on a Polygon-with-holes correctly excludes a
    route that only passes through a hole, so holes don't need separate
    handling here the way the visibility-graph side (extract_outer_rings)
    deliberately ignores them."""
    if len(route_coords) < 2:
        return []
    route = LineString(route_coords)
    crossed: list[CrossedParcel] = []
    for index, feature in enumerate(parcels.features):
        if route.intersects(feature_geometry(feature)):
            label = feature.properties.label or f"Flurstück {index + 1}"
            crossed.append(CrossedParcel(index=index, label=label))
    return crossed


def point_in_ring(point: Coord, ring: list[Coord]) -> bool:
    return Polygon(ring).contains(Point(point))
