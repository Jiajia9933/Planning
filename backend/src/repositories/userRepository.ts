import { pool } from '../db/pool'

export interface User {
  id: string
  email: string
  passwordHash: string
}

function mapRow(row: { id: string; email: string; password_hash: string }): User {
  return { id: row.id, email: row.email, passwordHash: row.password_hash }
}

export async function createUser(email: string, passwordHash: string): Promise<User> {
  const result = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, password_hash',
    [email, passwordHash],
  )
  return mapRow(result.rows[0])
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email])
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await pool.query('SELECT id, email, password_hash FROM users WHERE id = $1', [id])
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId])
}
