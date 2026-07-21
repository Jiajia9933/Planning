import express from 'express'
import cors from 'cors'
import { env } from './config/env'
import { authRouter } from './routes/auth'
import { projectsRouter } from './routes/projects'
import { calculateRouter } from './routes/calculate'
import { errorHandler } from './middleware/errorHandler'

/** Exported separately from index.ts so it can be imported directly by tests later, without starting a listener. */
export function createApp() {
  const app = express()
  app.use(cors({ origin: env.corsOrigin }))
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/projects', projectsRouter)
  app.use('/api/calculate', calculateRouter)

  app.use(errorHandler)

  return app
}
