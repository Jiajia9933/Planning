// Demo fixtures. The shapes come from src/types/hdd.ts, so later milestones
// swap this module for a real project-loading API without touching the
// panel components or store that consume it.
import type { PlanningParameters, UtilityLayerState } from '../types/hdd'

// Pre-bootstrap placeholder only — App.tsx's loading gate means this is
// never actually rendered. Null start/end matches the real backend default
// (see backend/src/db/defaultParameters.ts) so a fresh project starts empty.
export const mockPlanningParameters: PlanningParameters = {
  startPoint: null,
  endPoint: null,
  waypoints: [],
  drillRig: 'Bohrgerät1',
  pipeDiameterMm: 160,
  minDrillRadiusM: 30,
  entryAngleDeg: 12,
  exitAngleDeg: 12,
  maxDeflectionAngleDeg: 45,
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
