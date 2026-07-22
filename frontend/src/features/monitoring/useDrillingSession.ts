import { useCallback, useEffect, useRef, useState } from 'react'
import type { DrillingReading, GeoPoint } from '@hdd-planner/domain'
import { apiFetch } from '../auth/api'
import { DEVIATION_WARN_M } from './constants'

interface LiveResponse {
  newReadings: DrillingReading[]
  currentIndex: number
  totalReadings: number
  isComplete: boolean
}

interface ReplanResponse {
  newPlanPoints: GeoPoint[]
  turnWarning: string | null
  triggerIndex: number
}

/**
 * Owns the "Testlauf" (simulated drilling session) lifecycle: starts it on
 * the backend, then polls the live endpoint once a second, accumulating
 * readings locally. The backend session itself is a pure function of
 * wall-clock time (see routes/projects.ts), so this hook is just a thin
 * client for it — reloading the page and calling `start` again would be
 * wrong (it'd create a *new* session), but polling naturally resumes
 * correctly if this hook is remounted while one is already running.
 *
 * Also watches every newly-arrived reading for the first deviation-warning
 * crossing and, the instant it sees one, calls the replan endpoint
 * automatically — no confirmation step, matching how this was scoped.
 */
export function useDrillingSession(projectId: string | null) {
  const [readings, setReadings] = useState<DrillingReading[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [totalReadings, setTotalReadings] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [newPlanPoints, setNewPlanPoints] = useState<GeoPoint[] | null>(null)
  const [turnWarning, setTurnWarning] = useState<string | null>(null)
  const [replanTriggerIndex, setReplanTriggerIndex] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastIndexRef = useRef(-1)
  const hasReplannedRef = useRef(false)

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsRunning(false)
  }, [])

  const triggerReplan = useCallback(
    async (reading: DrillingReading) => {
      if (!projectId || hasReplannedRef.current) return
      // Set synchronously before the await so an overlapping poll tick
      // can't also fire a second replan while this one is in flight.
      hasReplannedRef.current = true
      try {
        const data = await apiFetch<ReplanResponse>(`/api/projects/${projectId}/drilling-session/replan`, {
          method: 'POST',
          body: { triggerElapsedS: reading.elapsedS },
        })
        setNewPlanPoints(data.newPlanPoints)
        setTurnWarning(data.turnWarning)
        setReplanTriggerIndex(data.triggerIndex)
      } catch {
        // Non-fatal — the run keeps going on the original plan if saving
        // the correction itself fails; the deviation readout still shows
        // the truth either way, and this lets a later reading retry.
        hasReplannedRef.current = false
      }
    },
    [projectId],
  )

  const poll = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await apiFetch<LiveResponse>(
        `/api/projects/${projectId}/drilling-session/live?sinceIndex=${lastIndexRef.current}`,
      )
      if (data.newReadings.length > 0) {
        lastIndexRef.current = data.currentIndex
        setReadings((prev) => [...prev, ...data.newReadings])

        if (!hasReplannedRef.current) {
          const deviating = data.newReadings.find((r) => r.lateralDeviationM >= DEVIATION_WARN_M)
          if (deviating) void triggerReplan(deviating)
        }
      }
      setTotalReadings(data.totalReadings)
      if (data.isComplete) {
        setIsComplete(true)
        stopPolling()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbindung zum Testlauf verloren.')
      stopPolling()
    }
  }, [projectId, stopPolling, triggerReplan])

  const start = useCallback(async () => {
    if (!projectId) return
    setError(null)
    setReadings([])
    setIsComplete(false)
    setNewPlanPoints(null)
    setTurnWarning(null)
    setReplanTriggerIndex(null)
    lastIndexRef.current = -1
    hasReplannedRef.current = false
    try {
      await apiFetch(`/api/projects/${projectId}/drilling-session/start`, { method: 'POST' })
      setIsRunning(true)
      await poll()
      intervalRef.current = setInterval(() => void poll(), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Testlauf konnte nicht gestartet werden.')
    }
  }, [projectId, poll])

  useEffect(() => stopPolling, [stopPolling])

  return {
    readings,
    isRunning,
    isComplete,
    totalReadings,
    error,
    newPlanPoints,
    turnWarning,
    replanTriggerIndex,
    start,
  }
}
