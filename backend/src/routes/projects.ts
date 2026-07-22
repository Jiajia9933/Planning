import { Router } from 'express'
import type { Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { isPlanningParameters, isFeatureCollection } from '../validators'
import { createProject, findProjectsByUserId, findOwnedProject, updateProjectParameters } from '../repositories/projectRepository'
import { defaultParameters } from '../db/defaultParameters'
import { upsertSpartenplan, findSpartenplanByProjectId, clearSpartenplan } from '../repositories/spartenplanRepository'
import { upsertParcels, findParcelsByProjectId, clearParcels } from '../repositories/parcelRepository'
import { createReport, findReportsByProjectId, findReportFile } from '../repositories/reportRepository'

export const projectsRouter = Router()
projectsRouter.use(requireAuth)

function isValidProjectName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100
}

function isUploadBody(value: unknown): value is { featureCollection: unknown; meta: unknown } {
  if (typeof value !== 'object' || value === null) return false
  const b = value as Record<string, unknown>
  return isFeatureCollection(b.featureCollection) && typeof b.meta === 'object' && b.meta !== null
}

function isReportBody(value: unknown): value is { projectName: string; fileBase64: string } {
  if (typeof value !== 'object' || value === null) return false
  const b = value as Record<string, unknown>
  return typeof b.projectName === 'string' && typeof b.fileBase64 === 'string' && b.fileBase64.length > 0
}

// Explicit user action — a project is never created automatically on
// register (see routes/auth.ts). Users can have any number of projects
// (see migration 003) — there's no longer a conflict case here.
projectsRouter.post('/', async (req, res, next) => {
  try {
    const name = req.body?.name
    if (!isValidProjectName(name)) {
      res.status(400).json({ error: 'A non-empty project name (max 100 characters) is required' })
      return
    }
    const project = await createProject(req.userId!, name.trim(), defaultParameters)
    res.status(201).json({ project: { id: project.id, name: project.name, code: project.code, parameters: project.parameters } })
  } catch (err) {
    next(err)
  }
})

projectsRouter.get('/', async (req, res, next) => {
  try {
    const projects = await findProjectsByUserId(req.userId!)
    res.json({ projects })
  } catch (err) {
    next(err)
  }
})

// Resolves :id to an owned project or writes a 404 and returns null —
// deliberately indistinguishable from "doesn't exist" so a guessed id
// belonging to another user can't be told apart from a made-up one.
async function requireOwnedProject(id: string, userId: string, res: Response) {
  const project = await findOwnedProject(id, userId)
  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return null
  }
  return project
}

projectsRouter.get('/:id', async (req, res, next) => {
  try {
    const project = await requireOwnedProject(req.params.id, req.userId!, res)
    if (!project) return
    const [spartenplan, parcels] = await Promise.all([
      findSpartenplanByProjectId(project.id),
      findParcelsByProjectId(project.id),
    ])
    res.json({
      project: { id: project.id, name: project.name, code: project.code, parameters: project.parameters },
      spartenplan,
      parcels,
    })
  } catch (err) {
    next(err)
  }
})

projectsRouter.put('/:id/parameters', async (req, res, next) => {
  try {
    if (!isPlanningParameters(req.body)) {
      res.status(400).json({ error: 'Request body is not a valid PlanningParameters object' })
      return
    }
    const project = await updateProjectParameters(req.params.id, req.userId!, req.body)
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    res.json({ project: { id: project.id, name: project.name, code: project.code, parameters: project.parameters } })
  } catch (err) {
    next(err)
  }
})

projectsRouter.put('/:id/spartenplan', async (req, res, next) => {
  try {
    if (!isUploadBody(req.body)) {
      res.status(400).json({ error: 'Request body must be { featureCollection, meta }' })
      return
    }
    const project = await requireOwnedProject(req.params.id, req.userId!, res)
    if (!project) return
    const upload = await upsertSpartenplan(project.id, req.body.featureCollection, req.body.meta)
    res.json({ spartenplan: upload })
  } catch (err) {
    next(err)
  }
})

projectsRouter.delete('/:id/spartenplan', async (req, res, next) => {
  try {
    const project = await requireOwnedProject(req.params.id, req.userId!, res)
    if (!project) return
    await clearSpartenplan(project.id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

projectsRouter.put('/:id/parcels', async (req, res, next) => {
  try {
    if (!isUploadBody(req.body)) {
      res.status(400).json({ error: 'Request body must be { featureCollection, meta }' })
      return
    }
    const project = await requireOwnedProject(req.params.id, req.userId!, res)
    if (!project) return
    const upload = await upsertParcels(project.id, req.body.featureCollection, req.body.meta)
    res.json({ parcels: upload })
  } catch (err) {
    next(err)
  }
})

projectsRouter.delete('/:id/parcels', async (req, res, next) => {
  try {
    const project = await requireOwnedProject(req.params.id, req.userId!, res)
    if (!project) return
    await clearParcels(project.id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

projectsRouter.post('/:id/reports', async (req, res, next) => {
  try {
    if (!isReportBody(req.body)) {
      res.status(400).json({ error: 'Request body must be { projectName, fileBase64 }' })
      return
    }
    const project = await requireOwnedProject(req.params.id, req.userId!, res)
    if (!project) return
    const report = await createReport(project.id, req.body.projectName, Buffer.from(req.body.fileBase64, 'base64'))
    res.status(201).json({ report })
  } catch (err) {
    next(err)
  }
})

projectsRouter.get('/:id/reports', async (req, res, next) => {
  try {
    const project = await requireOwnedProject(req.params.id, req.userId!, res)
    if (!project) return
    const reports = await findReportsByProjectId(project.id)
    res.json({ reports })
  } catch (err) {
    next(err)
  }
})

projectsRouter.get('/:id/reports/:reportId', async (req, res, next) => {
  try {
    const project = await requireOwnedProject(req.params.id, req.userId!, res)
    if (!project) return
    const file = await findReportFile(req.params.reportId, project.id)
    if (!file) {
      res.status(404).json({ error: 'Report not found' })
      return
    }
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${file.projectName.replace(/"/g, '')}-bericht.pdf"`)
    res.send(file.fileData)
  } catch (err) {
    next(err)
  }
})
