import type { NextFunction, Request, Response } from 'express'

function isPayloadTooLarge(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large'
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err)
  if (isPayloadTooLarge(err)) {
    res.status(413).json({ error: 'Upload zu groß' })
    return
  }
  res.status(500).json({ error: 'Internal server error' })
}
