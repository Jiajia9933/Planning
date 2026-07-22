import type { PlanningParameters } from '@hdd-planner/domain'
import { pool } from '../db/pool'
import { defaultParameters } from '../db/defaultParameters'

export interface Project {
  id: string
  userId: string
  name: string
  code: string
  parameters: PlanningParameters
}

// Projects saved before a field was added to PlanningParameters (e.g.
// maxDeflectionAngleDeg) have plain old JSONB on disk missing it — backfill
// from the current defaults on every read so old rows stay valid against
// today's stricter isPlanningParameters check, without a DB migration.
function mapRow(row: { id: string; user_id: string; name: string; code: string; parameters: PlanningParameters }): Project {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    code: row.code,
    parameters: { ...defaultParameters, ...row.parameters },
  }
}

function generateProjectCode(): string {
  return `HDD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

/** Explicit user action only — see routes/projects.ts's POST /. Never called on register. Callable multiple times per user now that projects.user_id is no longer UNIQUE (see migration 003). */
export async function createProject(userId: string, name: string, parameters: PlanningParameters): Promise<Project> {
  const result = await pool.query(
    `INSERT INTO projects (user_id, name, code, parameters)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, name, code, parameters`,
    [userId, name, generateProjectCode(), JSON.stringify(parameters)],
  )
  return mapRow(result.rows[0])
}

export interface ProjectSummary {
  id: string
  name: string
  code: string
  updatedAt: string
}

function mapSummaryRow(row: { id: string; name: string; code: string; updated_at: Date }): ProjectSummary {
  return { id: row.id, name: row.name, code: row.code, updatedAt: row.updated_at.toISOString() }
}

export async function findProjectsByUserId(userId: string): Promise<ProjectSummary[]> {
  const result = await pool.query(
    'SELECT id, name, code, updated_at FROM projects WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId],
  )
  return result.rows.map(mapSummaryRow)
}

/** Ownership check lives here — every route just treats a null result as 404, same IDOR-safe-by-construction pattern as the old userId-only lookup, now parameterized by a project id too. */
export async function findOwnedProject(id: string, userId: string): Promise<Project | null> {
  const result = await pool.query(
    'SELECT id, user_id, name, code, parameters FROM projects WHERE id = $1 AND user_id = $2',
    [id, userId],
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function updateProjectParameters(id: string, userId: string, parameters: PlanningParameters): Promise<Project | null> {
  const result = await pool.query(
    `UPDATE projects SET parameters = $1, updated_at = now()
     WHERE id = $2 AND user_id = $3
     RETURNING id, user_id, name, code, parameters`,
    [JSON.stringify(parameters), id, userId],
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}
