// Demo fixtures. The shapes come from src/types/hdd.ts, so later milestones
// swap this module for a real project-loading API without touching the
// panel components or store that consume it.
import type { PlanningParameters, UtilityLayerState } from '../types/hdd'

export const mockPlanningParameters: PlanningParameters = {
  startPoint: { lat: 52.520123, lng: 13.404954 },
  endPoint: { lat: 52.52089, lng: 13.407812 },
  drillRig: 'Vermeer D40x55',
  pipeDiameterMm: 160,
  minDrillRadiusM: 30,
  entryAngleDeg: 12,
  exitAngleDeg: 12,
  safetyDistanceM: 1.0,
}

export const mockUtilityLayers: UtilityLayerState[] = [
  { type: 'strom', label: 'Strom', visible: true },
  { type: 'gas', label: 'Gas', visible: true },
  { type: 'wasser', label: 'Wasser', visible: true },
  { type: 'fernwaerme', label: 'Fernwärme', visible: true },
  { type: 'telekommunikation', label: 'Telekommunikation', visible: true },
  { type: 'abwasser', label: 'Abwasser', visible: true },
]
