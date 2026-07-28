from app.models import GeoPoint, ParcelFeatureCollection
from app.optimizer import optimize_route
from app.parcel_crossing import find_crossed_parcels

# Degrees-per-meter at the equator, so test parcels/routes sit at realistic
# HDD scale (tens of meters) instead of the ~100km a raw degree offset would
# imply — LARGE_PENALTY_M (100_000m) only dominates a detour distance at
# that scale, per routeOptimizer.ts's own doc comment.
M = 1 / 111_320


def _square_parcel(cx: float, cy: float, half: float, label: str) -> dict:
    ring = [
        [cx - half, cy - half],
        [cx + half, cy - half],
        [cx + half, cy + half],
        [cx - half, cy + half],
        [cx - half, cy - half],
    ]
    return {
        "type": "Feature",
        "geometry": {"type": "Polygon", "coordinates": [ring]},
        "properties": {"label": label},
    }


def test_no_parcels_returns_empty():
    result = optimize_route(GeoPoint(lat=0, lng=0), GeoPoint(lat=0, lng=1), None)
    assert result.waypoints == []
    assert result.crossed_parcel_count == 0
    assert result.warnings == []


def test_route_not_crossing_any_parcel_returns_empty():
    parcels = ParcelFeatureCollection.model_validate(
        {"type": "FeatureCollection", "features": [_square_parcel(10, 10, 1, "Flurstück weit weg")]}
    )
    result = optimize_route(GeoPoint(lat=0, lng=0), GeoPoint(lat=0, lng=1), parcels)
    assert result.waypoints == []
    assert result.crossed_parcel_count == 0


def test_route_crossing_one_parcel_gets_routed_around_it():
    parcels = ParcelFeatureCollection.model_validate(
        {"type": "FeatureCollection", "features": [_square_parcel(55 * M, 0, 30 * M, "Flurstück 1")]}
    )
    start = GeoPoint(lat=0, lng=0)
    end = GeoPoint(lat=0, lng=110 * M)

    baseline = find_crossed_parcels([(0, 0), (110 * M, 0)], parcels)
    assert len(baseline) == 1

    result = optimize_route(start, end, parcels)
    assert len(result.waypoints) > 0
    assert result.crossed_parcel_count == 0
    assert result.warnings == []


def test_too_many_crossed_parcels_bails_out_with_warning():
    features = [_square_parcel(i * 0.02, 0, 0.008, f"Flurstück {i}") for i in range(41)]
    parcels = ParcelFeatureCollection.model_validate({"type": "FeatureCollection", "features": features})
    start = GeoPoint(lat=0, lng=0)
    end = GeoPoint(lat=0, lng=1)

    result = optimize_route(start, end, parcels)
    assert result.waypoints == []
    assert result.crossed_parcel_count == 41
    assert len(result.warnings) == 1
