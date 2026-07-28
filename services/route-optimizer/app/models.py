from typing import Literal, Union

from pydantic import BaseModel


class GeoPoint(BaseModel):
    lat: float
    lng: float


class ParcelFeatureProperties(BaseModel):
    label: str | None = None


class PolygonGeometry(BaseModel):
    type: Literal["Polygon"]
    coordinates: list[list[list[float]]]


class MultiPolygonGeometry(BaseModel):
    type: Literal["MultiPolygon"]
    coordinates: list[list[list[list[float]]]]


class ParcelFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: Union[PolygonGeometry, MultiPolygonGeometry]
    properties: ParcelFeatureProperties


class ParcelFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[ParcelFeature]


class OptimizeRouteRequest(BaseModel):
    start: GeoPoint
    end: GeoPoint
    parcels: ParcelFeatureCollection | None = None


class CrossedParcel(BaseModel):
    index: int
    label: str


class RouteOptimizationResult(BaseModel):
    waypoints: list[GeoPoint]
    crossed_parcel_count: int
    warnings: list[str]
