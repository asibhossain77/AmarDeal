import { randomInt } from 'crypto'
import { db } from '@/lib/db'

// Lazy, self-healing column creation for the WhatsApp verification flow.
// The column is also added by /api/health autoFixSchema — this ensures it
// exists even if /api/health has not been called since deployment.
let _verificationColumnEnsured = false

async function addVerificationColumn(): Promise<boolean> {
  try {
    await db.$executeRawUnsafe('ALTER TABLE "SellerApplication" ADD COLUMN "verificationCode" TEXT')
    console.log('[seller-verify] added SellerApplication.verificationCode column')
    return true
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/duplicate column|already exists/i.test(msg)) {
      return true
    }
    console.error('[seller-verify] ensure verificationCode column failed:', msg)
    return false
  }
}

/** Ensure the verificationCode column exists (memoized per process). */
export async function ensureVerificationColumn(): Promise<void> {
  if (_verificationColumnEnsured) return
  _verificationColumnEnsured = await addVerificationColumn()
}

/**
 * Run a SellerApplication query with automatic recovery when the
 * verificationCode column is missing (Prisma error P2022): add the
 * column, then retry the query once.
 */
export async function withVerificationColumn<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    const msg = err instanceof Error ? err.message : String(err)
    if (code === 'P2022' || /verificationCode/i.test(msg)) {
      _verificationColumnEnsured = false
      await ensureVerificationColumn()
      return await fn()
    }
    throw err
  }
}

/** Generate a random 6-digit numeric code (as string). */
export function generateVerificationCode(): string {
  return String(randomInt(100000, 1000000))
}

/** Normalize a user-entered code: Bengali digits → ASCII, strip everything except digits. */
export function normalizeCode(input: unknown): string {
  if (typeof input !== 'string') return ''
  const bengali = '০১২৩৪৫৬৭৮৯'
  return input
    .replace(/[০-৯]/g, (d) => String(bengali.indexOf(d)))
    .replace(/[^0-9]/g, '')
}
