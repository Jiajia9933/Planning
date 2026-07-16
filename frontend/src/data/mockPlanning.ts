// Demo fixtures for Milestone 1. The shapes come from src/types/hdd.ts, so
// later milestones swap this module for a real store/API without touching
// the panel components that consume it.
import type {
  PlanningParameters,
  PlanningResult,
  ProfileSample,
  UtilityLayerState,
} from '../types/hdd'

export const mockPlanningParameters: PlanningParameters = {
  startPoint: { lat: 52.520123, lng: 13.404954 },
  endPoint: { lat: 52.52089, lng: 13.407812 },
  drillRig: 'Vermeer D40x55',
  pipeDiameterMm: 160,
  minDrillRadiusM: 30,
  entryAngleDeg: 12,
  exitAngleDeg: 12,
}

export const mockPlanningResult: PlanningResult = {
  totalLengthM: 128.45,
  horizontalLengthM: 122.3,
  maxDepthM: 9.25,
  minRadiusM: 30.0,
  entryPoint: mockPlanningParameters.startPoint,
  exitPoint: mockPlanningParameters.endPoint,
  warnings: [],
}

export const mockUtilityLayers: UtilityLayerState[] = [
  { type: 'strom', label: 'Strom', visible: true },
  { type: 'gas', label: 'Gas', visible: true },
  { type: 'wasser', label: 'Wasser', visible: true },
  { type: 'fernwaerme', label: 'Fernwärme', visible: true },
  { type: 'telekommunikation', label: 'Telekommunikation', visible: true },
  { type: 'abwasser', label: 'Abwasser', visible: true },
]

// Sampled longitudinal profile (terrain vs. drill path vs. min-radius guide)
// used by the side-view chart placeholder until Milestone 5 wires it to a
// real geometry engine.
function buildMockProfile(): ProfileSample[] {
  const samples: ProfileSample[] = []
  const length = 128
  const steps = 32
  for (let i = 0; i <= steps; i++) {
    const distanceM = (length / steps) * i
    const t = distanceM / length
    const terrainHeightM = 49 - Math.sin(t * Math.PI) * 3.5 + Math.sin(t * 11) * 0.25
    const drillPathHeightM = 49 - Math.sin(t * Math.PI) * 19
    const minRadiusHeightM = 49 - Math.sin(t * Math.PI) * 16
    samples.push({ distanceM, terrainHeightM, drillPathHeightM, minRadiusHeightM })
  }
  return samples
}

export const mockProfile: ProfileSample[] = buildMockProfile()
