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

// ---------------------------------------------------------------------------
// Two seller roles (personal / business) — self-healing columns.
// The columns are also added by `prisma db push` (build step) and
// /api/health autoFixSchema — this is a third safety net so the runtime
// never crashes with P2022 on a production DB that missed migration.
// ---------------------------------------------------------------------------

type ColumnSpec = { table: string; column: string; ddl: string }

const SELLER_ROLE_COLUMNS: ColumnSpec[] = [
  { table: 'User', column: 'sellerRole', ddl: "TEXT NOT NULL DEFAULT 'personal'" },
  { table: 'User', column: 'businessVerified', ddl: 'BOOLEAN NOT NULL DEFAULT 0' },
  { table: 'SellerApplication', column: 'applicationType', ddl: "TEXT NOT NULL DEFAULT 'personal'" },
  { table: 'SellerApplication', column: 'idType', ddl: 'TEXT' },
  { table: 'SellerApplication', column: 'idNumber', ddl: 'TEXT' },
  { table: 'SellerApplication', column: 'documentImage', ddl: 'TEXT' },
]

const _ensuredRoleColumns = new Set<string>()

async function addRoleColumn({ table, column, ddl }: ColumnSpec): Promise<boolean> {
  try {
    await db.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${ddl}`)
    console.log(`[seller-verify] added ${table}.${column} column`)
    return true
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/duplicate column|already exists/i.test(msg)) return true
    console.error(`[seller-verify] ensure ${table}.${column} failed:`, msg)
    return false
  }
}

/** Ensure all two-seller-roles columns exist (memoized per process). */
export async function ensureSellerRoleColumns(): Promise<void> {
  for (const spec of SELLER_ROLE_COLUMNS) {
    if (_ensuredRoleColumns.has(spec.column + spec.table)) continue
    const ok = await addRoleColumn(spec)
    if (ok) _ensuredRoleColumns.add(spec.column + spec.table)
  }
}

/**
 * Run a query with automatic recovery when a two-seller-roles column is
 * missing (Prisma error P2022): add the missing columns, then retry once.
 */
export async function withSellerRoleColumns<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    const msg = err instanceof Error ? err.message : String(err)
    if (code === 'P2022' || /sellerRole|businessVerified|applicationType|idType|idNumber|documentImage/i.test(msg)) {
      _ensuredRoleColumns.clear()
      await ensureSellerRoleColumns()
      return await fn()
    }
    throw err
  }
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
