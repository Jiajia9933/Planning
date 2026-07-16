import type { PlanningParameters } from '../types/hdd'

const STORAGE_PREFIX = 'hdd-planner:project:'

export interface SavedProject {
  code: string
  parameters: PlanningParameters
  savedAt: string
}

/** Persists planning parameters under the project code — the only state that
 * needs saving, since results/profile/conflicts are always re-derived from
 * it. Swap for a real backend call when one exists; callers don't change. */
export function saveProject(code: string, parameters: PlanningParameters): void {
  const record: SavedProject = { code, parameters, savedAt: new Date().toISOString() }
  window.localStorage.setItem(STORAGE_PREFIX + code, JSON.stringify(record))
}

export function loadProject(code: string): SavedProject | null {
  const raw = window.localStorage.getItem(STORAGE_PREFIX + code)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SavedProject
    if (!parsed.parameters?.startPoint || !parsed.parameters?.endPoint) return null
    return parsed
  } catch {
    return null
  }
}
