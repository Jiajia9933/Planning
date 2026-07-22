// Core domain model for HDD (Horizontal Directional Drilling) planning.
// Shared between the frontend and backend so both consume the same shapes
// instead of re-deriving ad-hoc ones. UI-only types (e.g. UtilityLayerState)
// stay in the frontend and extend these.

export interface GeoPoint {
  lat: number
  lng: number
}

export type DrillRig =
  | 'Bohrgerät1'
  | 'Bohrgerät2'
  | 'Bohrgerät3'
  | 'Bohrgerät4'

export interface PlanningParameters {
  /** Null until the Bauleiter places it on the map — a new project starts empty, not at a fake default location. */
  startPoint: GeoPoint | null
  endPoint: GeoPoint | null
  /** Manually placed bend points between start and end — empty means a straight line. */
  waypoints: GeoPoint[]
  drillRig: DrillRig
  pipeDiameterMm: number
  minDrillRadiusM: number
  entryAngleDeg: number
  exitAngleDeg: number
  /** No bend (horizontal or vertical) may deflect more sharply than this — a real drill pipe can't suddenly rotate through a near-reversal. */
  maxDeflectionAngleDeg: number
  /** Minimum required clearance to existing utilities (§5.3 "Safety Distance"). */
  safetyDistanceM: number
}

/** `PlanningParameters` once Start/Ziel are both placed — the only shape the calculation engine accepts. */
export interface ResolvedPlanningParameters extends PlanningParameters {
  startPoint: GeoPoint
  endPoint: GeoPoint
}

export function isResolved(params: PlanningParameters): params is ResolvedPlanningParameters {
  return params.startPoint !== null && params.endPoint !== null
}

export interface PlanningResult {
  totalLengthM: number
  horizontalLengthM: number
  maxDepthM: number
  minRadiusM: number
  entryPoint: GeoPoint
  exitPoint: GeoPoint
  warnings: string[]
}

export type UtilityType =
  | 'strom'
  | 'gas'
  | 'wasser'
  | 'fernwaerme'
  | 'telekommunikation'
  | 'abwasser'

export interface ProfileSample {
  distanceM: number
  terrainHeightM: number
  drillPathHeightM: number
  minRadiusHeightM: number
}

/** Where the planned bore crosses a pre-existing utility, in plan and depth. */
export interface UtilityCrossing {
  type: UtilityType
  point: GeoPoint
  distanceM: number
  drillDepthM: number
  utilityDepthM: number
  clearanceM: number
  isConflict: boolean
}
