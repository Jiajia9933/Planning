import { Router } from 'express'
import type { Response } from 'express'
import { generateDrillingSession, replanFromCurrentPosition, applyManualSteering } from '@hdd-planner/domain'
import { requireAuth } from '../middleware/auth'
import { isPlanningParameters, isResolvedPlanningParameters, isFeatureCollection } from '../validators'
import { createProject, findProjectsByUserId, findOwnedProject, updateProjectParameters } from '../repositories/projectRepository'
import { defaultParameters } from '../db/defaultParameters'
import { upsertSpartenplan, findSpartenplanByProjectId, clearSpartenplan } from '../repositories/spartenplanRepository'
import { upsertParcels, findParcelsByProjectId, clearParcels } from '../repositories/parcelRepository'
import { createReport, findReportsByProjectId, findReportFile } from '../repositories/reportRepository'
import { createSession, findLatestSession, updateSessionReadings } from '../repositories/drillingSessionRepository'

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

// A typical bore takes tens of minutes to hours at real pilot-bore ROP —
// 200x makes even a longer one play out in a couple of real minutes.
const DEFAULT_PLAYBACK_SPEED = 200

projectsRouter.post('/:id/drilling-session/start', async (req, res, next) => {
  try {
    const project = await requireOwnedProject(req.params.id, req.userId!, res)
    if (!project) return
    if (!isResolvedPlanningParameters(project.parameters)) {
      res.status(400).json({ error: 'Start- und Zielpunkt müssen gesetzt sein, bevor ein Testlauf gestartet werden kann' })
      return
    }
    const manualMode = req.body?.manualMode === true
    const readings = generateDrillingSession(project.parameters, { manualDrift: manualMode })
    const session = await createSession(project.id, DEFAULT_PLAYBACK_SPEED, readings)
    res.status(201).json({
      startedAt: session.startedAt,
      playbackSpeed: session.playbackSpeed,
      totalReadings: readings.length,
    })
  } catch (err) {
    next(err)
  }
})

// Pure function of wall-clock time — no server-side timer keeps this
// running between polls, so it naturally resumes correctly across page
// reloads or backend restarts as long as the session row still exists.
projectsRouter.get('/:id/drilling-session/live', async (req, res, next) => {
  try {
    const project = await requireOwnedProject(req.params.id, req.userId!, res)
    if (!project) return
    const session = await findLatestSession(project.id)
    if (!session) {
      res.status(404).json({ error: 'No drilling session found for this project' })
      return
    }

    const sinceIndex = Number(req.query.sinceIndex ?? -1)
    const realElapsedS = (Date.now() - session.startedAt.getTime()) / 1000
    const simIndex = Math.min(
      session.readings.length - 1,
      Math.max(0, Math.floor(realElapsedS * session.playbackSpeed)),
    )
    const newReadings = session.readings.slice(Math.max(0, sinceIndex + 1), simIndex + 1)

    res.json({
      newReadings,
      currentIndex: simIndex,
      totalReadings: session.readings.length,
      isComplete: simIndex >= session.readings.length - 1,
    })
  } catch (err) {
    next(err)
  }
})

// Triggered automatically by the frontend the instant it sees a deviation
// cross the warn threshold — no confirmation step (see the Überwachung
// plan). Splices a freshly-generated corrected tail onto the existing
// session from the trigger point onward; the /live endpoint above needs no
// changes since it just re-reads whatever is currently stored.
projectsRouter.post('/:id/drilling-session/replan', async (req, res, next) => {
  try {
    const project = await requireOwnedProject(req.params.id, req.userId!, res)
    if (!project) return
    if (!isResolvedPlanningParameters(project.parameters)) {
      res.status(400).json({ error: 'Start- und Zielpunkt müssen gesetzt sein' })
      return
    }
    const session = await findLatestSession(project.id)
    if (!session) {
      res.status(404).json({ error: 'No drilling session found for this project' })
      return
    }

    const triggerElapsedS = Number(req.body?.triggerElapsedS)
    const triggerReading = session.readings[triggerElapsedS]
    if (!Number.isInteger(triggerElapsedS) || !triggerReading) {
      res.status(400).json({ error: 'triggerElapsedS is not a valid index into this session' })
      return
    }

    const { newPlanPoints, readings: newTail, turnWarning } = replanFromCurrentPosition(
      triggerReading,
      project.parameters,
    )
    const splicedReadings = [...session.readings.slice(0, triggerElapsedS), ...newTail]
    await updateSessionReadings(session.id, splicedReadings)

    res.json({ newPlanPoints, turnWarning, triggerIndex: triggerElapsedS })
  } catch (err) {
    next(err)
  }
})

// "Manuelle Steuerung" Testlauf mode: the Bauleiter holds a course
// correction via the keyboard (Draufsicht Pfeiltasten) instead of the
// automatic drift model. Persists the steered tail into the session so it
// survives a page reload/poll the same way a real correction would, and so
// a later /replan trigger reads a currentReading that reflects the actual
// steered position rather than the original (unsteered) precomputed one.
projectsRouter.post('/:id/drilling-session/steer', async (req, res, next) => {
  try {
    const project = await requireOwnedProject(req.params.id, req.userId!, res)
    if (!project) return
    if (!isResolvedPlanningParameters(project.parameters)) {
      res.status(400).json({ error: 'Start- und Zielpunkt müssen gesetzt sein' })
      return
    }
    const session = await findLatestSession(project.id)
    if (!session) {
      res.status(404).json({ error: 'No drilling session found for this project' })
      return
    }

    const atElapsedS = Number(req.body?.atElapsedS)
    const steeringOffsetDeg = Number(req.body?.steeringOffsetDeg)
    const verticalSteeringOffsetDeg = Number(req.body?.verticalSteeringOffsetDeg ?? 0)
    const currentReading = session.readings[atElapsedS]
    if (
      !Number.isInteger(atElapsedS) ||
      !currentReading ||
      !Number.isFinite(steeringOffsetDeg) ||
      !Number.isFinite(verticalSteeringOffsetDeg)
    ) {
      res.status(400).json({ error: 'atElapsedS/steeringOffsetDeg/verticalSteeringOffsetDeg invalid for this session' })
      return
    }

    const newTail = applyManualSteering(currentReading, project.parameters, steeringOffsetDeg, verticalSteeringOffsetDeg)
    const splicedReadings = [...session.readings.slice(0, atElapsedS + 1), ...newTail]
    await updateSessionReadings(session.id, splicedReadings)

    res.status(204).end()
  } catch (err) {
    next(err)
  }
})
