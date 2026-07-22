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
  // Last kick applied on each axis — display-only feedback (the kick itself
  // is one-off; the bit is already converging back before this even
  // re-renders), not a held state.
  const [lastHeadingKickDeg, setLastHeadingKickDeg] = useState<number | null>(null)
  const [lastVerticalKickDeg, setLastVerticalKickDeg] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastIndexRef = useRef(-1)
  const hasReplannedRef = useRef(false)
  // Mirrors `readings` state synchronously — the trend check needs the
  // merged history within the same poll tick, and React state updates
  // aren't synchronous.
  const readingsRef = useRef<DrillingReading[]>([])
  const manualModeRef = useRef(false)

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

  // "Manuelle Steuerung": each key press is a one-off kick to the bit's
  // current heading/pitch — persisted server-side (see the /steer route),
  // which regenerates the tail so it automatically curves back toward the
  // target from the next second on, no held rudder involved. A later
  // /replan trigger (if repeated kicks outpace the self-correction) reads
  // a currentReading that reflects wherever the bit actually is.
  const sendSteer = useCallback(
    async (headingKickDeg: number, verticalKickDeg: number) => {
      if (!projectId || readingsRef.current.length === 0) return
      const atElapsedS = readingsRef.current[readingsRef.current.length - 1].elapsedS
      try {
        await apiFetch(`/api/projects/${projectId}/drilling-session/steer`, {
          method: 'POST',
          body: { atElapsedS, headingKickDeg, verticalKickDeg },
        })
      } catch {
        // Non-fatal — a dropped steering command just leaves the run on
        // whatever course was already persisted; the next key press retries.
      }
    },
    [projectId],
  )

  const steer = useCallback(
    (deltaDeg: number) => {
      if (!manualModeRef.current) return
      setLastHeadingKickDeg(deltaDeg)
      void sendSteer(deltaDeg, 0)
    },
    [sendSteer],
  )

  const steerVertical = useCallback(
    (deltaDeg: number) => {
      if (!manualModeRef.current) return
      setLastVerticalKickDeg(deltaDeg)
      void sendSteer(0, deltaDeg)
    },
    [sendSteer],
  )

  const poll = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await apiFetch<LiveResponse>(
        `/api/projects/${projectId}/drilling-session/live?sinceIndex=${lastIndexRef.current}`,
      )
      let consumedThroughIndex = lastIndexRef.current
      if (data.newReadings.length > 0) {
        // At 200x playback, a single poll tick can reveal hundreds of
        // simulated seconds at once. If the trigger is found partway
        // through this batch, everything after it was captured *before*
        // the correction below runs — it's the stale, pre-replan
        // trajectory. Cut the batch off right there instead of appending
        // it: the next poll re-fetches from this point and gets the
        // corrected tail the backend is about to splice in. Without this,
        // the stale remainder (sometimes the entire rest of the run) stays
        // in `readings` forever and the correction is never visible.
        let batch = data.newReadings
        consumedThroughIndex = data.currentIndex

        if (!hasReplannedRef.current) {
          for (let i = 0; i < batch.length; i++) {
            const reading = batch[i]
            const crossedThreshold =
              reading.lateralDeviationM >= DEVIATION_WARN_M || Math.abs(reading.verticalDeviationM) >= DEVIATION_WARN_M
            const windowSoFar = [...readingsRef.current, ...batch.slice(0, i + 1)]
            const trending =
              isTrendingAway(windowSoFar, 'lateralDeviationM') || isTrendingAway(windowSoFar, 'verticalDeviationM')
            if (crossedThreshold || trending) {
              batch = batch.slice(0, i + 1)
              consumedThroughIndex = reading.elapsedS
              void triggerReplan(reading)
              break
            }
          }
        }

        readingsRef.current = [...readingsRef.current, ...batch]
        setReadings(readingsRef.current)
        lastIndexRef.current = consumedThroughIndex
      }
      setTotalReadings(data.totalReadings)
      // Only "complete" if we actually consumed all the way to the
      // server's current position — if the batch was cut short for a
      // fresh trigger, a corrected tail is still coming.
      if (data.isComplete && consumedThroughIndex === data.currentIndex) {
        setIsComplete(true)
        stopPolling()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbindung zum Testlauf verloren.')
      stopPolling()
    }
  }, [projectId, stopPolling, triggerReplan])

  const start = useCallback(
    async (manualMode = false) => {
      if (!projectId) return
      setError(null)
      setReadings([])
      setIsComplete(false)
      setNewPlanPoints(null)
      setTurnWarning(null)
      setReplanTriggerIndex(null)
      setLastHeadingKickDeg(null)
      setLastVerticalKickDeg(null)
      lastIndexRef.current = -1
      hasReplannedRef.current = false
      readingsRef.current = []
      manualModeRef.current = manualMode
      try {
        await apiFetch(`/api/projects/${projectId}/drilling-session/start`, { method: 'POST', body: { manualMode } })
        setIsRunning(true)
        await poll()
        intervalRef.current = setInterval(() => void poll(), 1000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Testlauf konnte nicht gestartet werden.')
      }
    },
    [projectId, poll],
  )

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
    lastHeadingKickDeg,
    lastVerticalKickDeg,
    steer,
    steerVertical,
    start,
  }
}
