import { NextResponse } from 'next/server'

export async function GET() {
  // Only return false — the actual check is done client-side by trying /api/auth/google
  // This avoids a DB call on every login page load
  return NextResponse.json({ enabled: false })
}
