import { env } from './config/env'
import { createApp } from './app'

createApp().listen(env.port, () => {
  console.log(`HDD Planner backend listening on http://localhost:${env.port}`)
})
