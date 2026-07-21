import { Router } from 'express'
import { computePlanning, detectUtilityConflicts, PROFILE_STEPS } from '@hdd-planner/domain'
import type { FeatureCollection, LineString } from 'geojson'
import type { UtilityType } from '@hdd-planner/domain'
import { requireAuth } from '../middleware/auth'
import { isPlanningParameters, isResolvedPlanningParameters, isFeatureCollection } from '../validators'

type SpartenplanFeatureCollection = FeatureCollection<LineString, { type: UtilityType }>

export const calculateRouter = Router()
calculateRouter.use(requireAuth)

// Stateless — takes parameters + the caller's current Spartenplan straight
// from the request body rather than re-reading the project, so the frontend
// can call this with not-yet-saved edits (e.g. before pressing "Speichern").
calculateRouter.post('/', (req, res, next) => {
  try {
    const { parameters, uploadedSpartenplan, terrainElevationsM: rawTerrainElevationsM } = req.body ?? {}
    if (!isPlanningParameters(parameters)) {
      res.status(400).json({ error: 'parameters is not a valid PlanningParameters object' })
      return
    }
    if (!isResolvedPlanningParameters(parameters)) {
      res.status(400).json({ error: 'startPoint and endPoint must both be set before calculating' })
      return
    }
    if (uploadedSpartenplan != null && !isFeatureCollection(uploadedSpartenplan)) {
      res.status(400).json({ error: 'uploadedSpartenplan must be a FeatureCollection or null' })
      return
    }
    // Optional real terrain elevation, sampled client-side (Cesium has no
    // server-side equivalent here) — silently ignored rather than rejected
    // if malformed or stale (e.g. sampled for a route that changed length a
    // moment later), since it's a visual enhancement, not a required input.
    const terrainElevationsM: number[] | undefined =
      Array.isArray(rawTerrainElevationsM) &&
      rawTerrainElevationsM.length === PROFILE_STEPS + 1 &&
      rawTerrainElevationsM.every((n: unknown) => typeof n === 'number' && Number.isFinite(n))
        ? rawTerrainElevationsM
        : undefined

    const { result, profile } = computePlanning(parameters, terrainElevationsM)
    // isFeatureCollection above only checks the GeoJSON envelope, not the
    // per-feature `properties.type` shape — trusted here the same way the
    // frontend already trusts its own shpjs-parsed output.
    const spartenplan = (uploadedSpartenplan ?? null) as SpartenplanFeatureCollection | null
    const conflicts = detectUtilityConflicts(parameters, profile, spartenplan)
    res.json({ result, profile, conflicts, terrainSource: terrainElevationsM ? 'real' : 'synthetic' })
  } catch (err) {
    next(err)
  }
})
