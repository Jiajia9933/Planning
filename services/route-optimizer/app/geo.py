import math

EARTH_RADIUS_M = 6371000.0


def haversine_distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """a, b are (lat, lng) pairs — great-circle distance in meters."""
    lat1, lng1 = a
    lat2, lng2 = b
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    sin_lat = math.sin(d_lat / 2)
    sin_lng = math.sin(d_lng / 2)
    h = sin_lat * sin_lat + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * sin_lng * sin_lng
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))
