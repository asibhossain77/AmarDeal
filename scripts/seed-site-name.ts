import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'
import * as fs from 'fs'

// Production creds are read from env — NEVER hardcode tokens in git.
// (The previously hardcoded tokens leaked into the repo and have since
// expired; they are intentionally not replaced here.)
// Resolution order: shell env → /home/z/my-project/.env → amardeal/.env
const env: Record<string, string> = {}
for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v
for (const envPath of ['/home/z/my-project/.env', '/home/z/my-project/amardeal/.env']) {
  try {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const [key, ...rest] = line.split('=')
      if (key && rest.length && env[key.trim()] === undefined) env[key.trim()] = rest.join('=').trim()
    }
  } catch { /* optional file */ }
}

const TURSO_URL = env.TURSO_DATABASE_URL || ''
const TURSO_TOKEN = env.TURSO_AUTH_TOKEN || ''
if (!TURSO_URL.startsWith('libsql://') || !TURSO_TOKEN) {
  console.error('❌ Missing production creds: set TURSO_DATABASE_URL (libsql://...) and TURSO_AUTH_TOKEN in /home/z/my-project/.env')
  process.exit(1)
}

async function main() {
  const libsql = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })
  const adapter = new PrismaLibSQL(libsql)
  const db = new PrismaClient({ adapter })

  await db.platformSetting.upsert({
    where: { key: 'platform_name' },
    update: { value: 'মিডম্যান', updatedAt: new Date() },
    create: { key: 'platform_name', value: 'মিডম্যান' },
  })

  await db.platformSetting.upsert({
    where: { key: 'platform_name_en' },
    update: { value: 'Midman', updatedAt: new Date() },
    create: { key: 'platform_name_en', value: 'Midman' },
  })

  console.log('✅ Turso seeded: EN=Midman, BN=মিডম্যান')
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
