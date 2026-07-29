import { env } from '../config/env'
import type { GeoPoint, ParcelFeatureCollection, RouteOptimizationResult } from '@hdd-planner/domain'

interface RemoteRouteOptimizationResult {
  waypoints: GeoPoint[]
  crossed_parcel_count: number
  warnings: string[]
}

/**
 * Calls the standalone Python route-optimizer service (services/route-optimizer)
 * instead of the old in-process TS implementation — see the project's
 * architecture notes for why only parcel avoidance moved here (utility
 * clash detection stays in @hdd-planner/domain since the frontend needs it
 * live). Deliberately no fallback to a local TS implementation on failure:
 * this throws, and callers let it surface as a 500 rather than silently
 * running a second, divergent avoidance algorithm.
 */
export async function optimizeRouteRemote(
  start: GeoPoint,
  end: GeoPoint,
  parcels: ParcelFeatureCollection | null,
): Promise<RouteOptimizationResult> {
  const res = await fetch(`${env.routeOptimizerUrl}/optimize-route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start, end, parcels }),
  })
  if (!res.ok) {
    throw new Error(`route-optimizer service responded with ${res.status}`)
  }
  const data = (await res.json()) as RemoteRouteOptimizationResult
  return { waypoints: data.waypoints, crossedParcelCount: data.crossed_parcel_count, warnings: data.warnings }
}
