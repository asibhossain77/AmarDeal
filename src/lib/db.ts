// Fully lazy PrismaClient — nothing is imported or executed at build time.
// The real Prisma modules are only loaded on the first runtime request.

type PrismaClientType = import('@prisma/client').PrismaClient

let _singleton: PrismaClientType | undefined

function getOrCreateClient(): PrismaClientType {
  if (_singleton) return _singleton

  // Dynamic require — only runs at request time, never during next build
  const { PrismaClient } = require('@prisma/client') as { PrismaClient: new () => PrismaClientType }

  const url = process.env.DATABASE_URL
  const token = process.env.TURSO_AUTH_TOKEN

  if (url?.startsWith('libsql://')) {
    console.log('[DB] Turso mode — adapter')
    const tursoUrl = url
    process.env.DATABASE_URL = 'file:./dummy.db'
    const { PrismaLibSQL } = require('@prisma/adapter-libsql')
    const { createClient } = require('@libsql/client')
    const libsqlClient = createClient({ url: tursoUrl, authToken: token })
    const adapter = new PrismaLibSQL(libsqlClient)
    _singleton = new PrismaClient({ adapter }) as unknown as PrismaClientType
  } else {
    console.log('[DB] Local SQLite mode')
    _singleton = new PrismaClient() as unknown as PrismaClientType
  }

  return _singleton
}

const handler: ProxyHandler<Record<string, unknown>> = {
  get(_target, prop) {
    const client = getOrCreateClient()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
}

export const db = new Proxy({} as PrismaClientType, handler)