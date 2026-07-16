import { create } from 'zustand'
import { mockPlanningParameters, mockUtilityLayers } from '../data/mockPlanning'
import { computePlanning } from '../domain/planningEngine'
import { detectUtilityConflicts } from '../domain/conflictDetection'
import type { GeoPoint, PlanningParameters, PlanningResult, ProfileSample, UtilityCrossing } from '../types/hdd'

export type PointKind = 'start' | 'end'

const utilityTypes = mockUtilityLayers.map((l) => l.type)

interface PlanningState {
  parameters: PlanningParameters
  result: PlanningResult
  profile: ProfileSample[]
  conflicts: UtilityCrossing[]
  isCalculating: boolean
  pointPickMode: PointKind | null
  setParameter: <K extends keyof PlanningParameters>(key: K, value: PlanningParameters[K]) => void
  setPoint: (kind: PointKind, point: GeoPoint) => void
  setPointPickMode: (mode: PointKind | null) => void
  calculate: () => void
}

function runPlanning(parameters: PlanningParameters) {
  const { result, profile } = computePlanning(parameters)
  const conflicts = detectUtilityConflicts(parameters, profile, utilityTypes)
  return { result, profile, conflicts }
}

const initialComputation = runPlanning(mockPlanningParameters)

export const usePlanningStore = create<PlanningState>((set, get) => ({
  parameters: mockPlanningParameters,
  result: initialComputation.result,
  profile: initialComputation.profile,
  conflicts: initialComputation.conflicts,
  isCalculating: false,
  pointPickMode: null,

  setParameter: (key, value) =>
    set((state) => ({ parameters: { ...state.parameters, [key]: value } })),

  setPoint: (kind, point) =>
    set((state) => ({
      parameters: {
        ...state.parameters,
        [kind === 'start' ? 'startPoint' : 'endPoint']: point,
      },
      pointPickMode: null,
    })),

  setPointPickMode: (mode) => set({ pointPickMode: mode }),

  calculate: () => {
    set({ isCalculating: true })
    const { parameters } = get()
    // Simulated latency so the button's loading state has somewhere to live;
    // swap for an await on the real backend call when one exists.
    window.setTimeout(() => {
      const { result, profile, conflicts } = runPlanning(parameters)
      set({ result, profile, conflicts, isCalculating: false })
    }, 500)
  },
}))
