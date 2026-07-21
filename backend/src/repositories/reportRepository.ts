import { pool } from '../db/pool'

export interface ReportSummary {
  id: string
  projectName: string
  createdAt: string
}

function mapSummaryRow(row: { id: string; project_name: string; created_at: Date }): ReportSummary {
  return { id: row.id, projectName: row.project_name, createdAt: row.created_at.toISOString() }
}

export async function createReport(projectId: string, projectName: string, fileData: Buffer): Promise<ReportSummary> {
  const result = await pool.query(
    `INSERT INTO reports (project_id, project_name, file_data)
     VALUES ($1, $2, $3)
     RETURNING id, project_name, created_at`,
    [projectId, projectName, fileData],
  )
  return mapSummaryRow(result.rows[0])
}

export async function findReportsByProjectId(projectId: string): Promise<ReportSummary[]> {
  const result = await pool.query(
    'SELECT id, project_name, created_at FROM reports WHERE project_id = $1 ORDER BY created_at DESC',
    [projectId],
  )
  return result.rows.map(mapSummaryRow)
}

/** Ownership is already established one level up (the project id itself was resolved via findOwnedProject) — this just scopes the file lookup to that same project. */
export async function findReportFile(id: string, projectId: string): Promise<{ fileData: Buffer; projectName: string } | null> {
  const result = await pool.query(
    'SELECT file_data, project_name FROM reports WHERE id = $1 AND project_id = $2',
    [id, projectId],
  )
  return result.rows[0] ? { fileData: result.rows[0].file_data, projectName: result.rows[0].project_name } : null
}
