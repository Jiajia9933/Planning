import express from 'express'
import cors from 'cors'
import { env } from './config/env'
import { authRouter } from './routes/auth'
import { projectsRouter } from './routes/projects'
import { calculateRouter } from './routes/calculate'
import { gebaeudeRouter } from './routes/gebaeude'
import { errorHandler } from './middleware/errorHandler'

/** Exported separately from index.ts so it can be imported directly by tests later, without starting a listener. */
export function createApp() {
  const app = express()
  app.use(cors({ origin: env.corsOrigin }))
  // Default is 100kb — real Spartenplan/Flurstücke GeoJSON uploads (hundreds
  // of features, each with multi-point boundary geometry) routinely exceed
  // that, so this isn't a generous headroom number, it's the actual size
  // this app's uploads need.
  app.use(express.json({ limit: '25mb' }))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/projects', projectsRouter)
  app.use('/api/calculate', calculateRouter)
  app.use('/api/gebaeude', gebaeudeRouter)

  app.use(errorHandler)

  return app
}
