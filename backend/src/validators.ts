import { isResolved } from '@hdd-planner/domain'
import type { PlanningParameters, ResolvedPlanningParameters } from '@hdd-planner/domain'

export function isGeoPoint(value: unknown): value is { lat: number; lng: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { lat: unknown }).lat === 'number' &&
    typeof (value as { lng: unknown }).lng === 'number'
  )
}

/**
 * Light shape check, not a full schema validator — catches obviously
 * malformed bodies. startPoint/endPoint may be null (an in-progress project
 * that hasn't had its points placed yet) — that's the whole point of this
 * type, not something to reject here. Use `isResolvedPlanningParameters`
 * where a real Start/Ziel is actually required (the calculate endpoint).
 */
export function isPlanningParameters(value: unknown): value is PlanningParameters {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  return (
    (p.startPoint === null || isGeoPoint(p.startPoint)) &&
    (p.endPoint === null || isGeoPoint(p.endPoint)) &&
    Array.isArray(p.waypoints) &&
    p.waypoints.every(isGeoPoint) &&
    typeof p.drillRig === 'string' &&
    typeof p.pipeDiameterMm === 'number' &&
    typeof p.minDrillRadiusM === 'number' &&
    typeof p.entryAngleDeg === 'number' &&
    typeof p.exitAngleDeg === 'number' &&
    typeof p.maxDeflectionAngleDeg === 'number' &&
    typeof p.safetyDistanceM === 'number'
  )
}

export function isResolvedPlanningParameters(value: unknown): value is ResolvedPlanningParameters {
  return isPlanningParameters(value) && isResolved(value)
}

/**
 * Light shape check only — the backend treats Spartenplan/Flurstücke
 * uploads as opaque GeoJSON it stores/passes through as-is; the frontend
 * (which already produced this via shpjs) owns the real shape.
 */
export function isFeatureCollection(value: unknown): value is { type: 'FeatureCollection'; features: unknown[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'FeatureCollection' &&
    Array.isArray((value as { features?: unknown }).features)
  )
}
