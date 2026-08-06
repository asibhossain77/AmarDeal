import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const SESSION_COOKIE = 'midman_session'

export interface AdminRecord {
  id: string
  userId: string
  role: string
  user: { id: string; name: string; email: string }
}

export type AdminGuardResult =
  | { ok: true; admin: AdminRecord }
  | { ok: false; response: NextResponse }

/**
 * Reads the `midman_session` cookie from the request and queries the
 * `admins` table to confirm the user is an administrator.
 *
 * Returns the admin record (joined with user) if valid, or null if:
 *  - No session cookie is present
 *  - The user ID in the cookie does not exist
 *  - The user is NOT in the `admins` table
 */
export async function getAdminFromRequest(
  _req: NextRequest
): Promise<AdminRecord | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE)

    if (!sessionCookie?.value) {
      return null
    }

    const userId = sessionCookie.value

    const admin = await db.admin.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!admin) {
      return null
    }

    return {
      id: admin.id,
      userId: admin.userId,
      role: admin.role,
      user: admin.user,
    }
  } catch (err) {
    console.error('[admin-guard] getAdminFromRequest error:', err)
    return null
  }
}

/**
 * Guard helper: call at the top of any /api/admin/* route handler.
 *
 * Returns a discriminated union:
 *  - `{ ok: true, admin }`   → proceed, admin is verified
 *  - `{ ok: false, response } → immediately return this response (401/403)
 *
 * Usage:
 *   const guard = await requireAdmin(req)
 *   if (!guard.ok) return guard.response
 *   const admin = guard.admin
 */
export async function requireAdmin(req: NextRequest): Promise<AdminGuardResult> {
  const admin = await getAdminFromRequest(req)

  if (!admin) {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE)

    if (!sessionCookie?.value) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'আনুষ্ঠানিকতা প্রয়োজন', code: 'NO_SESSION' },
          { status: 401 }
        ),
      }
    }

    return {
      ok: false,
      response: NextResponse.json(
        { error: 'অ্যাডমিন অনুমতি নেই', code: 'NOT_ADMIN' },
        { status: 403 }
      ),
    }
  }

  return { ok: true, admin }
}