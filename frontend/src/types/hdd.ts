// Core domain model for HDD (Horizontal Directional Drilling) planning.
// Shared across map, planning-form, side-view and 3D-viewer features so every
// milestone consumes the same shapes instead of re-deriving ad-hoc ones.

export interface GeoPoint {
  lat: number
  lng: number
}

export type DrillRig =
  | 'Vermeer D40x55'
  | 'Vermeer D24x40'
  | 'Ditch Witch JT30'
  | 'Herrenknecht HK50'

export interface PlanningParameters {
  startPoint: GeoPoint
  endPoint: GeoPoint
  drillRig: DrillRig
  pipeDiameterMm: number
  minDrillRadiusM: number
  entryAngleDeg: number
  exitAngleDeg: number
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

export interface UtilityLayerState {
  type: UtilityType
  label: string
  visible: boolean
}

export interface ProfileSample {
  distanceM: number
  terrainHeightM: number
  drillPathHeightM: number
  minRadiusHeightM: number
}
