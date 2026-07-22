import type { DrillingReading } from '@hdd-planner/domain'
import { pool } from '../db/pool'

export interface DrillingSession {
  id: string
  projectId: string
  startedAt: Date
  playbackSpeed: number
  readings: DrillingReading[]
}

function mapRow(row: {
  id: string
  project_id: string
  started_at: Date
  playback_speed: string
  readings: DrillingReading[]
}): DrillingSession {
  return {
    id: row.id,
    projectId: row.project_id,
    startedAt: row.started_at,
    playbackSpeed: Number(row.playback_speed),
    readings: row.readings,
  }
}

export async function createSession(
  projectId: string,
  playbackSpeed: number,
  readings: DrillingReading[],
): Promise<DrillingSession> {
  const result = await pool.query(
    `INSERT INTO drilling_sessions (project_id, playback_speed, readings)
     VALUES ($1, $2, $3)
     RETURNING id, project_id, started_at, playback_speed, readings`,
    [projectId, playbackSpeed, JSON.stringify(readings)],
  )
  return mapRow(result.rows[0])
}

/** Only the most recently started session per project — this feature only ever cares about "the current Testlauf," not a history browser. */
export async function findLatestSession(projectId: string): Promise<DrillingSession | null> {
  const result = await pool.query(
    `SELECT id, project_id, started_at, playback_speed, readings
     FROM drilling_sessions
     WHERE project_id = $1
     ORDER BY started_at DESC
     LIMIT 1`,
    [projectId],
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

/** Overwrites the whole readings array (the caller already spliced old-head + new-tail in JS) — jsonb has no native array-slice operator worth fighting for a one-off write like this. */
export async function updateSessionReadings(sessionId: string, readings: DrillingReading[]): Promise<void> {
  await pool.query('UPDATE drilling_sessions SET readings = $1 WHERE id = $2', [JSON.stringify(readings), sessionId])
}
