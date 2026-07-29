import 'dotenv/config'

/** Reads and validates process.env once at startup, so every other module imports typed values, not process.env directly. */
export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://hdd:hdd_dev@localhost:5432/hdd_planner',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-before-deploying',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // Password-reset emails. resendApiKey is empty by default — forgot-password
  // requests still succeed (no user-enumeration leak) but the send is
  // skipped with a console warning until a real key is set.
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173',
  routeOptimizerUrl: process.env.ROUTE_OPTIMIZER_URL ?? 'http://localhost:8001',
}
