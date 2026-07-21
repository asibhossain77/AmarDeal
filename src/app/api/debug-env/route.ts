import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.substring(0, 30) + '...)' : 'UNDEFINED',
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? 'SET' : 'UNDEFINED',
    NODE_ENV: process.env.NODE_ENV || 'UNDEFINED',
    allKeys: Object.keys(process.env).filter(k => k.startsWith('DATA') || k.startsWith('TURSO') || k.startsWith('NODE')),
  })
}