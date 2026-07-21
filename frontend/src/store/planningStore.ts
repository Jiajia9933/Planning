import { create } from 'zustand'
import type { FeatureCollection, LineString } from 'geojson'
import { mockPlanningParameters } from '../data/mockPlanning'
import { buildRoutePoints, insertPointAtBestIndex, isResolved } from '@hdd-planner/domain'
import { apiFetch, ApiError } from '../features/auth/api'
import type { SpartenplanMeta } from '../domain/spartenplan/types'
import type { ParcelFeatureCollection } from '../domain/flurstuecke/shapefileImport'
import type { ParcelsMeta } from '../domain/flurstuecke/types'
import type {
  GeoPoint,
  PlanningParameters,
  PlanningResult,
  ProfileSample,
  UtilityCrossing,
  UtilityType,
} from '../types/hdd'

export type PointKind = 'start' | 'end'
export type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'no-project' | 'error'

type UploadedSpartenplan = FeatureCollection<LineString, { type: UtilityType }> | null

interface ProjectPayload {
  name: string
  code: string
  parameters: PlanningParameters
}

interface BootstrapPayload {
  project: ProjectPayload
  spartenplan: { featureCollection: UploadedSpartenplan; meta: SpartenplanMeta } | null
  parcels: { featureCollection: ParcelFeatureCollection; meta: ParcelsMeta } | null
}

interface CalculatePayload {
  result: PlanningResult
  profile: ProfileSample[]
  conflicts: UtilityCrossing[]
  terrainSource: 'real' | 'synthetic'
}

// Inert dummy, not a real-looking coordinate — shown only before `status`
// leaves 'idle'/'loading' (see App.tsx's gate) and, once resolved-vs-not is
// checked by consumers, never actually rendered even then.
const placeholderResult: PlanningResult = {
  totalLengthM: 0,
  horizontalLengthM: 0,
  maxDepthM: 0,
  minRadiusM: 0,
  entryPoint: { lat: 0, lng: 0 },
  exitPoint: { lat: 0, lng: 0 },
  warnings: [],
}

interface PlanningState {
  status: BootstrapStatus
  projectName: string
  projectCode: string
  parameters: PlanningParameters
  result: PlanningResult
  profile: ProfileSample[]
  conflicts: UtilityCrossing[]
  isCalculating: boolean
  isSaving: boolean
  pointPickMode: PointKind | null
  activeNavId: string
  uploadedSpartenplan: UploadedSpartenplan
  spartenplanMeta: SpartenplanMeta | null
  uploadedParcels: ParcelFeatureCollection | null
  parcelsMeta: ParcelsMeta | null
  /** Real per-route-point terrain elevation, pushed in by Viewer3DPanel's Cesium terrain sampling. Null until sampled (or when no Ion terrain is available) — calculate() falls back to the synthetic profile shape in that case. */
  terrainElevationsM: number[] | null
  terrainSource: 'real' | 'synthetic'

  bootstrap: () => Promise<void>
  createProject: (name: string) => Promise<void>
  setParameter: <K extends keyof PlanningParameters>(key: K, value: PlanningParameters[K]) => void
  setPoint: (kind: PointKind, point: GeoPoint) => void
  addWaypoint: (point: GeoPoint) => void
  moveWaypoint: (index: number, point: GeoPoint) => void
  removeWaypoint: (index: number) => void
  setPointPickMode: (mode: PointKind | null) => void
  setActiveNavId: (id: string) => void
  saveParameters: () => Promise<void>
  setUploadedSpartenplan: (fc: UploadedSpartenplan, meta: SpartenplanMeta) => Promise<void>
  clearUploadedSpartenplan: () => Promise<void>
  setUploadedParcels: (fc: ParcelFeatureCollection, meta: ParcelsMeta) => Promise<void>
  clearUploadedParcels: () => Promise<void>
  setTerrainElevations: (elevationsM: number[] | null) => void
  calculate: () => Promise<void>
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  status: 'idle',
  projectName: '',
  projectCode: '',
  parameters: mockPlanningParameters,
  result: placeholderResult,
  profile: [],
  conflicts: [],
  isCalculating: false,
  isSaving: false,
  pointPickMode: null,
  activeNavId: 'karte',
  uploadedSpartenplan: null,
  spartenplanMeta: null,
  uploadedParcels: null,
  parcelsMeta: null,
  terrainElevationsM: null,
  terrainSource: 'synthetic',

  bootstrap: async () => {
    set({ status: 'loading' })
    try {
      const data = await apiFetch<BootstrapPayload>('/api/projects/me')
      set({
        status: 'ready',
        projectName: data.project.name,
        projectCode: data.project.code,
        parameters: data.project.parameters,
        uploadedSpartenplan: data.spartenplan?.featureCollection ?? null,
        spartenplanMeta: data.spartenplan?.meta ?? null,
        uploadedParcels: data.parcels?.featureCollection ?? null,
        parcelsMeta: data.parcels?.meta ?? null,
      })
      if (isResolved(data.project.parameters)) {
        await get().calculate()
      }
    } catch (err) {
      set({ status: err instanceof ApiError && err.status === 404 ? 'no-project' : 'error' })
    }
  },

  createProject: async (name) => {
    const data = await apiFetch<{ project: ProjectPayload }>('/api/projects/me', {
      method: 'POST',
      body: { name },
    })
    set({
      status: 'ready',
      projectName: data.project.name,
      projectCode: data.project.code,
      parameters: data.project.parameters,
    })
    if (isResolved(data.project.parameters)) {
      await get().calculate()
    }
  },

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

  // Waypoints bend a route that doesn't exist yet without both endpoints —
  // no-op (return state unchanged) rather than operate on null points.
  addWaypoint: (point) =>
    set((state) => {
      if (!isResolved(state.parameters)) return state
      const { startPoint, endPoint, waypoints } = state.parameters
      const routePoints = buildRoutePoints(startPoint, endPoint, waypoints)
      const nextRoutePoints = insertPointAtBestIndex(routePoints, point)
      return { parameters: { ...state.parameters, waypoints: nextRoutePoints.slice(1, -1) } }
    }),

  moveWaypoint: (index, point) =>
    set((state) => {
      if (!isResolved(state.parameters)) return state
      const waypoints = [...state.parameters.waypoints]
      waypoints[index] = point
      return { parameters: { ...state.parameters, waypoints } }
    }),

  removeWaypoint: (index) =>
    set((state) => {
      if (!isResolved(state.parameters)) return state
      return {
        parameters: {
          ...state.parameters,
          waypoints: state.parameters.waypoints.filter((_, i) => i !== index),
        },
      }
    }),

  setPointPickMode: (mode) => set({ pointPickMode: mode }),

  setActiveNavId: (id) => set({ activeNavId: id }),

  saveParameters: async () => {
    set({ isSaving: true })
    try {
      await apiFetch('/api/projects/me/parameters', { method: 'PUT', body: get().parameters })
    } finally {
      set({ isSaving: false })
    }
  },

  setUploadedSpartenplan: async (fc, meta) => {
    const data = await apiFetch<{ spartenplan: { featureCollection: UploadedSpartenplan; meta: SpartenplanMeta } }>(
      '/api/projects/me/spartenplan',
      { method: 'PUT', body: { featureCollection: fc, meta } },
    )
    set({ uploadedSpartenplan: data.spartenplan.featureCollection, spartenplanMeta: data.spartenplan.meta })
    if (isResolved(get().parameters)) {
      await get().calculate()
    }
  },

  clearUploadedSpartenplan: async () => {
    await apiFetch('/api/projects/me/spartenplan', { method: 'DELETE' })
    set({ uploadedSpartenplan: null, spartenplanMeta: null })
    if (isResolved(get().parameters)) {
      await get().calculate()
    }
  },

  setUploadedParcels: async (fc, meta) => {
    const data = await apiFetch<{ parcels: { featureCollection: ParcelFeatureCollection; meta: ParcelsMeta } }>(
      '/api/projects/me/parcels',
      { method: 'PUT', body: { featureCollection: fc, meta } },
    )
    set({ uploadedParcels: data.parcels.featureCollection, parcelsMeta: data.parcels.meta })
  },

  clearUploadedParcels: async () => {
    await apiFetch('/api/projects/me/parcels', { method: 'DELETE' })
    set({ uploadedParcels: null, parcelsMeta: null })
  },

  setTerrainElevations: (elevationsM) => set({ terrainElevationsM: elevationsM }),

  // Recompute is server-side now — errors are swallowed here (logged, not
  // rethrown) since this also runs implicitly after bootstrap/upload changes
  // where there's no dedicated UI to catch a rejection; the "Planung
  // berechnen" button only cares that `isCalculating` flips back off.
  calculate: async () => {
    const { parameters, uploadedSpartenplan, terrainElevationsM } = get()
    if (!isResolved(parameters)) return
    set({ isCalculating: true })
    try {
      const data = await apiFetch<CalculatePayload>('/api/calculate', {
        method: 'POST',
        body: { parameters, uploadedSpartenplan, terrainElevationsM },
      })
      set({ result: data.result, profile: data.profile, conflicts: data.conflicts, terrainSource: data.terrainSource })
    } catch (err) {
      console.error('Berechnung fehlgeschlagen:', err)
    } finally {
      set({ isCalculating: false })
    }
  },
}))
