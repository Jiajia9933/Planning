from fastapi import FastAPI

from .models import OptimizeRouteRequest, RouteOptimizationResult
from .optimizer import optimize_route

app = FastAPI(title="route-optimizer")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/optimize-route", response_model=RouteOptimizationResult)
def optimize_route_endpoint(req: OptimizeRouteRequest) -> RouteOptimizationResult:
    return optimize_route(req.start, req.end, req.parcels)
