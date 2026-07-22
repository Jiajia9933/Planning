import { useCallback, useEffect, useRef, useState } from 'react'
import type { DrillingReading, GeoPoint } from '@hdd-planner/domain'
import { apiFetch } from '../auth/api'
import {
  DEVIATION_WARN_M,
  TREND_WINDOW_S,
  TREND_MIN_GROWTH_M,
  TREND_MIN_ABSOLUTE_M,
  TREND_NOISE_TOLERANCE_M,
} from './constants'

interface LiveResponse {
  newReadings: DrillingReading[]
  currentIndex: number
  totalReadings: number
  isComplete: boolean
}

type DeviationKey = 'lateralDeviationM' | 'verticalDeviationM'

/** True once |deviation| has been consistently growing over the trailing window and has cleared a small absolute floor — fires well before the hard DEVIATION_WARN_M ceiling, as soon as a real trend (not just noise) is clear. */
function isTrendingAway(recent: DrillingReading[], key: DeviationKey): boolean {
  if (recent.length < TREND_WINDOW_S) return false
  const window = recent.slice(-TREND_WINDOW_S).map((r) => Math.abs(r[key]))
  const growing = window.every((v, i) => i === 0 || v >= window[i - 1] - TREND_NOISE_TOLERANCE_M)
  const grew = window[window.length - 1] - window[0] >= TREND_MIN_GROWTH_M
  const aboveFloor = window[window.length - 1] >= TREND_MIN_ABSOLUTE_M
  return growing && grew && aboveFloor
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
  // Mirrors `readings` state synchronously — the trend check needs the
  // merged history within the same poll tick, and React state updates
  // aren't synchronous.
  const readingsRef = useRef<DrillingReading[]>([])

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
        const startIdx = readingsRef.current.length
        readingsRef.current = [...readingsRef.current, ...data.newReadings]
        setReadings(readingsRef.current)

        if (!hasReplannedRef.current) {
          for (let i = startIdx; i < readingsRef.current.length; i++) {
            const reading = readingsRef.current[i]
            const crossedThreshold =
              reading.lateralDeviationM >= DEVIATION_WARN_M || Math.abs(reading.verticalDeviationM) >= DEVIATION_WARN_M
            const windowSoFar = readingsRef.current.slice(0, i + 1)
            const trending =
              isTrendingAway(windowSoFar, 'lateralDeviationM') || isTrendingAway(windowSoFar, 'verticalDeviationM')
            if (crossedThreshold || trending) {
              void triggerReplan(reading)
              break
            }
          }
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
    readingsRef.current = []
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
