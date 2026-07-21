import { Router } from 'express'
import type { Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { isPlanningParameters, isFeatureCollection } from '../validators'
import { createProject, findProjectByUserId, updateProjectParameters } from '../repositories/projectRepository'
import { defaultParameters } from '../db/defaultParameters'
import { upsertSpartenplan, findSpartenplanByProjectId, clearSpartenplan } from '../repositories/spartenplanRepository'
import { upsertParcels, findParcelsByProjectId, clearParcels } from '../repositories/parcelRepository'

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

// Explicit user action — a project is never created automatically on
// register (see routes/auth.ts). The DB's UNIQUE(user_id) constraint makes
// a second call here a 409, matching the "one project per user" model.
projectsRouter.post('/me', async (req, res, next) => {
  try {
    const name = req.body?.name
    if (!isValidProjectName(name)) {
      res.status(400).json({ error: 'A non-empty project name (max 100 characters) is required' })
      return
    }
    if (await findProjectByUserId(req.userId!)) {
      res.status(409).json({ error: 'This user already has a project' })
      return
    }
    const project = await createProject(req.userId!, name.trim(), defaultParameters)
    res.status(201).json({ project: { name: project.name, code: project.code, parameters: project.parameters } })
  } catch (err) {
    next(err)
  }
})

projectsRouter.get('/me', async (req, res, next) => {
  try {
    const project = await findProjectByUserId(req.userId!)
    if (!project) {
      res.status(404).json({ error: 'No project found for this user' })
      return
    }
    const [spartenplan, parcels] = await Promise.all([
      findSpartenplanByProjectId(project.id),
      findParcelsByProjectId(project.id),
    ])
    res.json({
      project: { name: project.name, code: project.code, parameters: project.parameters },
      spartenplan,
      parcels,
    })
  } catch (err) {
    next(err)
  }
})

projectsRouter.put('/me/parameters', async (req, res, next) => {
  try {
    if (!isPlanningParameters(req.body)) {
      res.status(400).json({ error: 'Request body is not a valid PlanningParameters object' })
      return
    }
    const project = await updateProjectParameters(req.userId!, req.body)
    if (!project) {
      res.status(404).json({ error: 'No project found for this user' })
      return
    }
    res.json({ project: { name: project.name, code: project.code, parameters: project.parameters } })
  } catch (err) {
    next(err)
  }
})

async function requireProjectId(userId: string, res: Response): Promise<string | null> {
  const project = await findProjectByUserId(userId)
  if (!project) {
    res.status(404).json({ error: 'No project found for this user' })
    return null
  }
  return project.id
}

projectsRouter.put('/me/spartenplan', async (req, res, next) => {
  try {
    if (!isUploadBody(req.body)) {
      res.status(400).json({ error: 'Request body must be { featureCollection, meta }' })
      return
    }
    const projectId = await requireProjectId(req.userId!, res)
    if (!projectId) return
    const upload = await upsertSpartenplan(projectId, req.body.featureCollection, req.body.meta)
    res.json({ spartenplan: upload })
  } catch (err) {
    next(err)
  }
})

projectsRouter.delete('/me/spartenplan', async (req, res, next) => {
  try {
    const projectId = await requireProjectId(req.userId!, res)
    if (!projectId) return
    await clearSpartenplan(projectId)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

projectsRouter.put('/me/parcels', async (req, res, next) => {
  try {
    if (!isUploadBody(req.body)) {
      res.status(400).json({ error: 'Request body must be { featureCollection, meta }' })
      return
    }
    const projectId = await requireProjectId(req.userId!, res)
    if (!projectId) return
    const upload = await upsertParcels(projectId, req.body.featureCollection, req.body.meta)
    res.json({ parcels: upload })
  } catch (err) {
    next(err)
  }
})

projectsRouter.delete('/me/parcels', async (req, res, next) => {
  try {
    const projectId = await requireProjectId(req.userId!, res)
    if (!projectId) return
    await clearParcels(projectId)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
