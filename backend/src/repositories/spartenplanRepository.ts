import { pool } from '../db/pool'

export interface Upload {
  featureCollection: unknown
  meta: unknown
}

function mapRow(row: { feature_collection: unknown; meta: unknown }): Upload {
  return { featureCollection: row.feature_collection, meta: row.meta }
}

export async function upsertSpartenplan(projectId: string, featureCollection: unknown, meta: unknown): Promise<Upload> {
  const result = await pool.query(
    `INSERT INTO spartenplan_uploads (project_id, feature_collection, meta)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id) DO UPDATE SET feature_collection = $2, meta = $3, uploaded_at = now()
     RETURNING feature_collection, meta`,
    [projectId, JSON.stringify(featureCollection), JSON.stringify(meta)],
  )
  return mapRow(result.rows[0])
}

export async function findSpartenplanByProjectId(projectId: string): Promise<Upload | null> {
  const result = await pool.query(
    'SELECT feature_collection, meta FROM spartenplan_uploads WHERE project_id = $1',
    [projectId],
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function clearSpartenplan(projectId: string): Promise<void> {
  await pool.query('DELETE FROM spartenplan_uploads WHERE project_id = $1', [projectId])
}
