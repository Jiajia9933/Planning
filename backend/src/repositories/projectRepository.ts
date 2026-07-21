import type { PlanningParameters } from '@hdd-planner/domain'
import { pool } from '../db/pool'

export interface Project {
  id: string
  userId: string
  name: string
  code: string
  parameters: PlanningParameters
}

function mapRow(row: { id: string; user_id: string; name: string; code: string; parameters: PlanningParameters }): Project {
  return { id: row.id, userId: row.user_id, name: row.name, code: row.code, parameters: row.parameters }
}

function generateProjectCode(): string {
  return `HDD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

/** Explicit user action only — see routes/projects.ts's POST /me. Never called on register. */
export async function createProject(userId: string, name: string, parameters: PlanningParameters): Promise<Project> {
  const result = await pool.query(
    `INSERT INTO projects (user_id, name, code, parameters)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, name, code, parameters`,
    [userId, name, generateProjectCode(), JSON.stringify(parameters)],
  )
  return mapRow(result.rows[0])
}

export async function findProjectByUserId(userId: string): Promise<Project | null> {
  const result = await pool.query(
    'SELECT id, user_id, name, code, parameters FROM projects WHERE user_id = $1',
    [userId],
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function updateProjectParameters(userId: string, parameters: PlanningParameters): Promise<Project | null> {
  const result = await pool.query(
    `UPDATE projects SET parameters = $1, updated_at = now()
     WHERE user_id = $2
     RETURNING id, user_id, name, code, parameters`,
    [JSON.stringify(parameters), userId],
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}
