import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'
import { ensureSchema } from '@/lib/ensure-schema'

const SEED_ADMIN_SQL = `
INSERT OR IGNORE INTO "User" ("id", "name", "phone", "email", "password", "isSeller", "isActive", "emailVerified", "createdAt", "updatedAt")
VALUES ('cmrar4fgy0000vcitwu695oe7', 'অ্যাডমিন', '01700000000', 'admin@demo.com', '123456', 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "Admin" ("id", "userId", "role", "permissions", "createdAt", "updatedAt")
VALUES ('cmrar4fgy0001vcit6evmxgcu', 'cmrar4fgy0000vcitwu695oe7', 'super_admin', '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "PlatformSetting" ("key", "value", "updatedAt")
VALUES ('contract_text', 'এই চুক্তি অনুযায়ী উভয় পক্ষ সম্মত হলো।', CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "PlatformSetting" ("key", "value", "updatedAt")
VALUES ('platform_name', 'Amar Deal', CURRENT_TIMESTAMP);
`

/**
 * Health + DB diagnostic + auto-setup endpoint.
 *
 * ALWAYS runs runtime schema healing (create missing tables + add missing
 * columns — see lib/ensure-schema.ts), because production (Turso) drifts
 * behind the schema new deploys expect. Healing is memoized per process,
 * so repeat hits are cheap.
 */
export async function GET() {
  const url = process.env.DATABASE_URL ?? ''
  const token = process.env.TURSO_AUTH_TOKEN

  const info: Record<string, string> = {
    nodeEnv: process.env.NODE_ENV || 'not set',
    hasDbUrl: url ? 'yes' : 'NO',
    dbUrlPrefix: url.substring(0, 30),
    hasTursoToken: token ? 'yes' : 'NO',
  }

  // Direct Turso connectivity check (bypass Prisma entirely)
  if (url.startsWith('libsql://')) {
    if (!token) {
      info['directTurso'] = 'FAILED - missing TURSO_AUTH_TOKEN'
      return NextResponse.json(info)
    }
    try {
      const client = createClient({ url, authToken: token })
      await client.execute('SELECT 1')
      info['directTurso'] = 'OK'
      await client.close()
    } catch (err: any) {
      info['directTurso'] = 'FAILED'
      info['tursoError'] = err.message?.substring(0, 300) || String(err)
    }
  }

  // Runtime schema healing (memoized once per process)
  try {
    const report = await ensureSchema()
    info['schemaHeal'] = report.alreadyUpToDate
      ? 'OK (already up to date)'
      : `tables: ${report.tablesCreated.join(', ') || 'none'}; columns: ${report.columnsAdded.join(', ') || 'none'}`
    if (report.errors.length) info['schemaHealErrors'] = report.errors.slice(0, 25).join(' | ')
  } catch (err: any) {
    info['schemaHeal'] = 'FAILED'
    info['schemaHealError'] = err.message?.substring(0, 300) || String(err)
  }

  // Prisma test + admin seed for fresh/empty databases
  try {
    const { db } = await import('@/lib/db')
    const userCount = await db.user.count()
    info['prismaConnection'] = 'OK'
    info['prismaUserCount'] = String(userCount)
    if (userCount === 0) {
      try {
        for (const sql of SEED_ADMIN_SQL.split(';').map(s => s.trim()).filter(Boolean)) {
          await db.$executeRawUnsafe(sql)
        }
        info['adminSeed'] = 'OK'
      } catch (err: any) {
        info['adminSeed'] = 'error: ' + (err.message?.substring(0, 120) || '?')
      }
    }
  } catch (err: any) {
    info['prismaConnection'] = 'FAILED'
    info['prismaError'] = err.message?.substring(0, 300) || String(err)
  }

  return NextResponse.json(info)
}
