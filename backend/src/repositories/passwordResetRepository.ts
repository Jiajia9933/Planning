import crypto from 'node:crypto'
import { pool } from '../db/pool'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function createResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
  await pool.query('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [
    userId,
    token,
    expiresAt,
  ])
  return token
}

export async function findValidResetToken(token: string): Promise<{ userId: string } | null> {
  const result = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM password_reset_tokens
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()`,
    [token],
  )
  return result.rows[0] ? { userId: result.rows[0].user_id } : null
}

export async function markResetTokenUsed(token: string): Promise<void> {
  await pool.query('UPDATE password_reset_tokens SET used_at = now() WHERE token = $1', [token])
}
