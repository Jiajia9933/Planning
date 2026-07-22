import { create } from 'zustand'
import type { FeatureCollection, LineString } from 'geojson'
import { mockPlanningParameters } from '../data/mockPlanning'
import { buildRoutePoints, insertPointAtBestIndex, isResolved } from '@hdd-planner/domain'
import { apiFetch, apiFetchBlob } from '../features/auth/api'
import { buildReportPdf } from '../domain/reportPdf'
import type { SpartenplanMeta } from '../domain/spartenplan/types'
import type { ParcelsMeta } from '../domain/flurstuecke/types'
import type {
  GeoPoint,
  PlanningParameters,
  PlanningResult,
  ProfileSample,
  UtilityCrossing,
  UtilityType,
  ParcelFeatureCollection,
} from '../types/hdd'

export type PointKind = 'start' | 'end'
export type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'error'

type UploadedSpartenplan = FeatureCollection<LineString, { type: UtilityType }> | null

/** Lightweight — the Projekt picker list doesn't need full parameters per project. */
export interface ProjectSummary {
  id: string
  name: string
  code: string
  updatedAt: string
}

interface ProjectPayload {
  id: string
  name: string
  code: string
  parameters: PlanningParameters
}

interface ProjectListPayload {
  projects: ProjectSummary[]
}

interface ProjectDetailPayload {
  project: ProjectPayload
  spartenplan: { featureCollection: UploadedSpartenplan; meta: SpartenplanMeta } | null
  parcels: { featureCollection: ParcelFeatureCollection; meta: ParcelsMeta } | null
}

export interface ReportSummary {
  id: string
  projectName: string
  createdAt: string
}

// Remembers which project to reopen on the next visit — purely a UX
// convenience (skip the picker for a returning single/multi-project user),
// never trusted as an access-control decision (the backend re-checks
// ownership on every request regardless).
const LAST_PROJECT_ID_KEY = 'hdd-planner:lastProjectId'

interface CalculatePayload {
  result: PlanningResult
  profile: ProfileSample[]
  conflicts: UtilityCrossing[]
  effectiveWaypoints: GeoPoint[]
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
  projects: ProjectSummary[]
  currentProjectId: string | null
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
  reports: ReportSummary[]

  bootstrap: () => Promise<void>
  openProject: (id: string) => Promise<void>
  createProject: (name: string) => Promise<void>
  setParameter: <K extends keyof PlanningParameters>(key: K, value: PlanningParameters[K]) => void
  setPoint: (kind: PointKind, point: GeoPoint) => void
  addWaypoint: (point: GeoPoint) => void
  moveWaypoint: (index: number, point: GeoPoint) => void
  removeWaypoint: (index: number) => void
  setWaypoints: (waypoints: GeoPoint[]) => void
  setPointPickMode: (mode: PointKind | null) => void
  setActiveNavId: (id: string) => void
  saveParameters: () => Promise<void>
  setUploadedSpartenplan: (fc: UploadedSpartenplan, meta: SpartenplanMeta) => Promise<void>
  clearUploadedSpartenplan: () => Promise<void>
  setUploadedParcels: (fc: ParcelFeatureCollection, meta: ParcelsMeta) => Promise<void>
  clearUploadedParcels: () => Promise<void>
  setTerrainElevations: (elevationsM: number[] | null) => void
  calculate: () => Promise<void>
  createReport: () => Promise<void>
  loadReports: () => Promise<void>
  downloadReport: (reportId: string) => Promise<void>
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  status: 'idle',
  projects: [],
  currentProjectId: null,
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
  reports: [],

  // Fetches the user's project list, then decides whether to open one
  // automatically (see LAST_PROJECT_ID_KEY / single-project cases) or leave
  // currentProjectId null so AppShell shows the Projekt picker.
  bootstrap: async () => {
    set({ status: 'loading' })
    try {
      const data = await apiFetch<ProjectListPayload>('/api/projects')
      set({ status: 'ready', projects: data.projects })

      const rememberedId = localStorage.getItem(LAST_PROJECT_ID_KEY)
      const toOpen =
        (rememberedId && data.projects.find((p) => p.id === rememberedId)?.id) ??
        (data.projects.length === 1 ? data.projects[0].id : null)
      if (toOpen) await get().openProject(toOpen)
    } catch {
      set({ status: 'error' })
    }
  },

  openProject: async (id) => {
    const data = await apiFetch<ProjectDetailPayload>(`/api/projects/${id}`)
    localStorage.setItem(LAST_PROJECT_ID_KEY, id)
    set({
      currentProjectId: data.project.id,
      projectName: data.project.name,
      projectCode: data.project.code,
      parameters: data.project.parameters,
      uploadedSpartenplan: data.spartenplan?.featureCollection ?? null,
      spartenplanMeta: data.spartenplan?.meta ?? null,
      uploadedParcels: data.parcels?.featureCollection ?? null,
      parcelsMeta: data.parcels?.meta ?? null,
      result: placeholderResult,
      profile: [],
      conflicts: [],
      terrainSource: 'synthetic',
      activeNavId: get().activeNavId === 'projekt' ? 'karte' : get().activeNavId,
    })
    if (isResolved(data.project.parameters)) {
      await get().calculate()
    }
  },

  createProject: async (name) => {
    const data = await apiFetch<{ project: ProjectPayload }>('/api/projects', {
      method: 'POST',
      body: { name },
    })
    set((state) => ({
      projects: [
        { id: data.project.id, name: data.project.name, code: data.project.code, updatedAt: new Date().toISOString() },
        ...state.projects,
      ],
    }))
    await get().openProject(data.project.id)
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

  // Bulk-replace, unlike the single-point add/move/remove above — used by
  // "Route optimieren" to hand over its whole proposed waypoint sequence.
  setWaypoints: (waypoints) =>
    set((state) => {
      if (!isResolved(state.parameters)) return state
      return { parameters: { ...state.parameters, waypoints } }
    }),

  setPointPickMode: (mode) => set({ pointPickMode: mode }),

  setActiveNavId: (id) => set({ activeNavId: id }),

  saveParameters: async () => {
    const projectId = get().currentProjectId
    if (!projectId) return
    set({ isSaving: true })
    try {
      await apiFetch(`/api/projects/${projectId}/parameters`, { method: 'PUT', body: get().parameters })
    } finally {
      set({ isSaving: false })
    }
  },

  setUploadedSpartenplan: async (fc, meta) => {
    const projectId = get().currentProjectId
    if (!projectId) return
    const data = await apiFetch<{ spartenplan: { featureCollection: UploadedSpartenplan; meta: SpartenplanMeta } }>(
      `/api/projects/${projectId}/spartenplan`,
      { method: 'PUT', body: { featureCollection: fc, meta } },
    )
    set({ uploadedSpartenplan: data.spartenplan.featureCollection, spartenplanMeta: data.spartenplan.meta })
    if (isResolved(get().parameters)) {
      await get().calculate()
    }
  },

  clearUploadedSpartenplan: async () => {
    const projectId = get().currentProjectId
    if (!projectId) return
    await apiFetch(`/api/projects/${projectId}/spartenplan`, { method: 'DELETE' })
    set({ uploadedSpartenplan: null, spartenplanMeta: null })
    if (isResolved(get().parameters)) {
      await get().calculate()
    }
  },

  setUploadedParcels: async (fc, meta) => {
    const projectId = get().currentProjectId
    if (!projectId) return
    const data = await apiFetch<{ parcels: { featureCollection: ParcelFeatureCollection; meta: ParcelsMeta } }>(
      `/api/projects/${projectId}/parcels`,
      { method: 'PUT', body: { featureCollection: fc, meta } },
    )
    set({ uploadedParcels: data.parcels.featureCollection, parcelsMeta: data.parcels.meta })
  },

  clearUploadedParcels: async () => {
    const projectId = get().currentProjectId
    if (!projectId) return
    await apiFetch(`/api/projects/${projectId}/parcels`, { method: 'DELETE' })
    set({ uploadedParcels: null, parcelsMeta: null })
  },

  setTerrainElevations: (elevationsM) => set({ terrainElevationsM: elevationsM }),

  // Recompute is server-side now — errors are swallowed here (logged, not
  // rethrown) since this also runs implicitly after bootstrap/upload changes
  // where there's no dedicated UI to catch a rejection; the "Planung
  // berechnen" button only cares that `isCalculating` flips back off.
  // After every calculation, parameters.waypoints is overwritten with
  // whatever was actually planned (parcel avoidance and/or sharp-bend
  // smoothing insertions) — draggable waypoint markers on the map will
  // visibly shift/multiply. This keeps the effective route consistent
  // everywhere (map, 3D view, conflict detection, exported reports) instead
  // of silently drifting from what was actually planned.
  calculate: async () => {
    const { parameters, uploadedSpartenplan, uploadedParcels, terrainElevationsM } = get()
    if (!isResolved(parameters)) return
    set({ isCalculating: true })
    try {
      const data = await apiFetch<CalculatePayload>('/api/calculate', {
        method: 'POST',
        body: { parameters, uploadedSpartenplan, uploadedParcels, terrainElevationsM },
      })
      set((state) => ({
        result: data.result,
        profile: data.profile,
        conflicts: data.conflicts,
        terrainSource: data.terrainSource,
        parameters: { ...state.parameters, waypoints: data.effectiveWaypoints },
      }))
    } catch (err) {
      console.error('Berechnung fehlgeschlagen:', err)
    } finally {
      set({ isCalculating: false })
    }
  },

  createReport: async () => {
    const { currentProjectId, projectName, projectCode, parameters, result, conflicts } = get()
    if (!currentProjectId) return
    const pdfBlob = buildReportPdf(projectName, projectCode, parameters, result, conflicts)
    const fileBase64 = await blobToBase64(pdfBlob)
    const data = await apiFetch<{ report: ReportSummary }>(`/api/projects/${currentProjectId}/reports`, {
      method: 'POST',
      body: { projectName, fileBase64 },
    })
    set((state) => ({ reports: [data.report, ...state.reports] }))
    triggerBlobDownload(pdfBlob, `${projectName}-bericht.pdf`)
  },

  loadReports: async () => {
    const projectId = get().currentProjectId
    if (!projectId) return
    const data = await apiFetch<{ reports: ReportSummary[] }>(`/api/projects/${projectId}/reports`)
    set({ reports: data.reports })
  },

  downloadReport: async (reportId) => {
    const projectId = get().currentProjectId
    if (!projectId) return
    const report = get().reports.find((r) => r.id === reportId)
    const blob = await apiFetchBlob(`/api/projects/${projectId}/reports/${reportId}`)
    triggerBlobDownload(blob, `${report?.projectName ?? 'bericht'}-bericht.pdf`)
  },
}))

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
