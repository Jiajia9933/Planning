import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { fetchExternalGebaeude } from '../services/gebaeudeExternalSource'
import { queryGebaeudeCache } from '../services/gebaeudeCacheSource'

export const gebaeudeRouter = Router()
gebaeudeRouter.use(requireAuth)

// A single HDD route spans tens to a few hundred meters — rejecting
// anything wildly larger than that stops this proxy from being used to
// bulk-scrape the whole state through the app.
const MAX_BBOX_SPAN_DEG = 0.05

function parseBbox(value: unknown): [number, number, number, number] | null {
  if (typeof value !== 'string') return null
  const parts = value.split(',').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [minLng, minLat, maxLng, maxLat] = parts
  if (minLng >= maxLng || minLat >= maxLat) return null
  if (maxLng - minLng > MAX_BBOX_SPAN_DEG || maxLat - minLat > MAX_BBOX_SPAN_DEG) return null
  return [minLng, minLat, maxLng, maxLat]
}

gebaeudeRouter.get('/external', async (req, res, next) => {
  try {
    const bbox = parseBbox(req.query.bbox)
    if (!bbox) {
      res.status(400).json({ error: 'bbox must be "minLng,minLat,maxLng,maxLat" and span a reasonably small area' })
      return
    }
    const parcels = await fetchExternalGebaeude(bbox)
    res.json({ parcels })
  } catch (err) {
    next(err)
  }
})

// Serves locally imported Gebäude data (see db/importGebaeudeCache.ts) for
// states without a live queryable API of their own — currently just
// Bavaria's Oberbayern Hausumringe import.
gebaeudeRouter.get('/cache', async (req, res, next) => {
  try {
    const bbox = parseBbox(req.query.bbox)
    if (!bbox) {
      res.status(400).json({ error: 'bbox must be "minLng,minLat,maxLng,maxLat" and span a reasonably small area' })
      return
    }
    const source = typeof req.query.source === 'string' ? req.query.source : null
    if (!source) {
      res.status(400).json({ error: 'source is required (e.g. "bayern-hausumringe-oberbayern")' })
      return
    }
    const parcels = await queryGebaeudeCache(bbox, source)
    res.json({ parcels })
  } catch (err) {
    next(err)
  }
})
