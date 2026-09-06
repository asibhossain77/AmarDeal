// Fully lazy PrismaClient — nothing is imported or executed at build time.
// The real Prisma modules are only loaded on the first runtime request.

type PrismaClientType = import('@prisma/client').PrismaClient

let _singleton: PrismaClientType | undefined
let _initError: string | undefined

function getOrCreateClient(): PrismaClientType {
  if (_initError) {
    throw new Error(`DB init failed: ${_initError}`)
  }
  if (_singleton) return _singleton

  try {
    // Dynamic require — only runs at request time, never during next build
    const { PrismaClient } = require('@prisma/client') as { PrismaClient: new () => PrismaClientType }

    const url = process.env.DATABASE_URL
    const token = process.env.TURSO_AUTH_TOKEN

    if (url?.startsWith('libsql://')) {
      if (!token) {
        _initError = 'TURSO_AUTH_TOKEN is not set'
        throw new Error(_initError)
      }
      console.log('[DB] Turso mode — adapter')
      const tursoUrl = url
      const { PrismaLibSQL } = require('@prisma/adapter-libsql')
      const { createClient } = require('@libsql/client')
      const libsqlClient = createClient({ url: tursoUrl, authToken: token })
      const adapter = new PrismaLibSQL(libsqlClient)
      // Temporarily point DATABASE_URL to a dummy sqlite file so Prisma's
      // engine does not try to connect to libsql:// itself. CRITICAL: restore
      // the real value immediately after — overwriting process.env globally
      // poisons other db.ts module instances (separate route bundles), which
      // then fall into "Local SQLite mode" on dummy.db and crash with
      // P2021 "table main.User does not exist" (breaks login in production).
      const savedUrl = process.env.DATABASE_URL
      process.env.DATABASE_URL = 'file:./dummy.db'
      try {
        _singleton = new PrismaClient({ adapter }) as unknown as PrismaClientType
      } finally {
        process.env.DATABASE_URL = savedUrl
      }
    } else {
      console.log('[DB] Local SQLite mode —', url)
      _singleton = new PrismaClient() as unknown as PrismaClientType
    }

    return _singleton
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[DB] Failed to initialize:', msg)
    _initError = msg
    throw new Error(`DB init failed: ${msg}`)
  }
}

const handler: ProxyHandler<Record<string, unknown>> = {
  get(_target, prop) {
    try {
      const client = getOrCreateClient()
      const value = (client as any)[prop]
      if (typeof value === 'function') {
        return value.bind(client)
      }
      return value
    } catch (err) {
      // For 'then' (Promise check) or Symbol.toStringTag, don't log
      if (prop === 'then' || typeof prop === 'symbol') {
        return undefined
      }
      console.error(`[DB] Error accessing db.${String(prop)}:`, err instanceof Error ? err.message : err)
      throw err
    }
  },
}

export const db = new Proxy({} as PrismaClientType, handler)