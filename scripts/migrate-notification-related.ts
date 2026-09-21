/**
 * Production (Turso) migration for the notification system upgrade:
 *   ALTER TABLE Notification ADD COLUMN relatedType / relatedId
 *   + composite (userId, read) index.
 * Idempotent — skips columns/indexes that already exist.
 * Creds: shell env → /home/z/my-project/.env → amardeal/.env
 * Run: bun scripts/migrate-notification-related.ts
 */

import fs from 'fs'

function resolveCreds(): { url: string; token: string } {
  const url =
    process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || ''
  const token = process.env.TURSO_AUTH_TOKEN || ''
  if (url.startsWith('libsql://') && token) return { url, token }

  for (const p of ['/home/z/my-project/.env', '/home/z/my-project/amardeal/.env']) {
    try {
      const lines = fs.readFileSync(p, 'utf8').split('\n')
      let u = ''
      let t = ''
      for (const line of lines) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/)
        if (!m) continue
        if (m[1] === 'TURSO_DATABASE_URL' || m[1] === 'DATABASE_URL') u = u || m[2].trim()
        if (m[1] === 'TURSO_AUTH_TOKEN') t = t || m[2].trim()
      }
      if (u.startsWith('libsql://') && t) return { url: u, token: t }
    } catch {
      /* file missing */
    }
  }
  console.error('❌ No libsql:// URL + TURSO_AUTH_TOKEN found (checked env + /home/z/my-project/.env)')
  process.exit(1)
}

const { url, token } = resolveCreds()
const apiBase = url.replace(/^libsql:/, 'https:') + '/v2/pipeline'

async function pipeline(stmts: { sql: string; args?: any[] }[]) {
  const requests: any[] = stmts.map((s) => ({ type: 'execute', stmt: { sql: s.sql, args: s.args || [] } }))
  requests.push({ type: 'close' })
  const res = await fetch(apiBase, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    throw new Error(`pipeline HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const json = await res.json()
  return json.results.map((r: any) => r.result)
}

async function main() {
  console.log('db:', url)

  // 1. Inspect current columns + indexes
  const [colsRes] = await pipeline([
    { sql: "SELECT name FROM pragma_table_info('Notification')" },
  ])
  const cols: string[] = colsRes?.rows?.map((r: any) => r.name) || []
  console.log('existing columns:', cols.join(', '))
  if (cols.length === 0) {
    console.error('❌ Notification table not found in production db!')
    process.exit(1)
  }

  const statements: { sql: string; args?: any[] }[] = []
  if (!cols.includes('relatedType')) statements.push({ sql: `ALTER TABLE Notification ADD COLUMN relatedType TEXT` })
  if (!cols.includes('relatedId')) statements.push({ sql: `ALTER TABLE Notification ADD COLUMN relatedId TEXT` })

  const [idxRes] = await pipeline([
    { sql: "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='Notification'" },
  ])
  const idxNames: string[] = idxRes?.rows?.map((r: any) => r.name) || []
  if (!idxNames.includes('Notification_userId_read_idx')) {
    statements.push({ sql: `CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read")` })
  }

  if (statements.length === 0) {
    console.log('✅ Nothing to do — migration already applied')
    return
  }

  // 2. Apply
  const results = await pipeline(statements)
  results.forEach((r: any, i: number) => {
    if (r?.type === 'error') console.error(`❌ stmt ${i} failed:`, r.error?.message)
    else console.log(`✅ stmt ${i} ok`)
  })

  // 3. Verify
  const [vCols] = await pipeline([{ sql: "SELECT name FROM pragma_table_info('Notification')" }])
  const finalCols: string[] = vCols?.rows?.map((r: any) => r.name) || []
  console.log('final columns:', finalCols.join(', '))
  if (!finalCols.includes('relatedType') || !finalCols.includes('relatedId')) {
    console.error('❌ Verification FAILED — columns missing after migration')
    process.exit(1)
  }
  console.log('🎉 Production migration verified')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
