import type { PlanningParameters } from '@hdd-planner/domain'

/**
 * Seeded onto every newly created project. Start/Ziel are left unset — a
 * new project shows an empty map until the Bauleiter places real points,
 * not a pre-drawn demo route. Engineering defaults are sensible starting
 * values only.
 */
export const defaultParameters: PlanningParameters = {
  startPoint: null,
  endPoint: null,
  waypoints: [],
  drillRig: 'Vermeer D40x55',
  pipeDiameterMm: 160,
  minDrillRadiusM: 30,
  entryAngleDeg: 12,
  exitAngleDeg: 12,
  safetyDistanceM: 1.0,
}
