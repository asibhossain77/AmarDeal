import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const SESSION_COOKIE = 'amdeal_session'

/* ═══════════════════════════════════════════════════════════
   Auth Guard — get user ID from session cookie
   ═══════════════════════════════════════════════════════════ */

export type AuthGuardResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

/**
 * Reads the `amdeal_session` cookie and returns the authenticated user's ID.
 * Does NOT check admin status — use `requireAdmin` for admin routes.
 *
 * Returns:
 *  - `{ ok: true, userId }`  → valid session
 *  - `{ ok: false, response }` → return this immediately (401)
 */
export async function requireAuth(req: NextRequest): Promise<AuthGuardResult> {
  try {
    // Try cookie first, then fall back to X-User-Id header (for sandbox/proxy envs)
    let userId: string | undefined

    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE)
    if (sessionCookie?.value) {
      userId = sessionCookie.value
    } else {
      userId = req.headers.get('x-user-id') || undefined
    }

    if (!userId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'লগইন করুন', code: 'NO_SESSION' },
          { status: 401 }
        ),
      }
    }

    // Verify the user actually exists
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'ব্যবহারকারী পাওয়া যায়নি', code: 'INVALID_SESSION' },
          { status: 401 }
        ),
      }
    }

    return { ok: true, userId }
  } catch (err) {
    console.error('[auth-guard] requireAuth error:', err)
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'অনুমোদন যাচাই ব্যর্থ', code: 'AUTH_ERROR' },
        { status: 500 }
      ),
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   Deal Access Guard — auth + ownership check
   ═══════════════════════════════════════════════════════════ */

export type DealAccessResult =
  | { ok: true; userId: string; deal: { id: string; buyerId: string; sellerId: string | null } }
  | { ok: false; response: NextResponse }

/**
 * Authenticates the user AND verifies they are the buyer or seller of the deal.
 *
 * Returns:
 *  - `{ ok: true, userId, deal }` → user owns this deal, proceed
 *  - `{ ok: false, response }` → return this immediately (401 / 403 / 404)
 *
 * Usage:
 *   const guard = await requireDealAccess(req, dealId)
 *   if (!guard.ok) return guard.response
 *   // guard.userId, guard.deal are available
 */
export async function requireDealAccess(
  req: NextRequest,
  dealId: string
): Promise<DealAccessResult> {
  // Step 1: Authenticate
  const auth = await requireAuth(req)
  if (!auth.ok) return { ok: false, response: auth.response }
  const userId = auth.userId

  // Step 2: Fetch deal
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    select: { id: true, buyerId: true, sellerId: true, creatorId: true },
  })

  if (!deal) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'ডিল পাওয়া যায়নি', code: 'DEAL_NOT_FOUND' },
        { status: 404 }
      ),
    }
  }

  // Step 3: Ownership check — user must be buyer, seller, or creator
  const isBuyer = deal.buyerId === userId
  const isSeller = deal.sellerId === userId
  const isCreator = deal.creatorId === userId

  if (!isBuyer && !isSeller && !isCreator) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'এই ডিল দেখার অনুমতি নেই', code: 'FORBIDDEN' },
        { status: 403 }
      ),
    }
  }

  return { ok: true, userId, deal }
}