import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const applied = new Set(
    (await pool.query<{ filename: string }>('SELECT filename FROM _migrations')).rows.map((r) => r.filename),
  )

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip  ${file} (already applied)`)
      continue
    }
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`apply ${file}`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  await pool.end()
  console.log('Migrations up to date.')
}

run().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
