/**
 * Password hashing utilities using bcryptjs.
 * All password operations MUST go through these helpers.
 */
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/** Hash a plaintext password (use on register, reset, admin-set) */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Compare a plaintext password against a hash (use on login, change-password) */
export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  // Support migration: if stored password is not a bcrypt hash (plain text), compare directly
  // and return a special marker so caller can re-hash
  if (!hash.startsWith('$2')) {
    return plain === hash ? (plain as unknown as true) : false;
  }
  return bcrypt.compare(plain, hash);
}

/**
 * Check if a stored password hash needs re-hashing (migration from plaintext).
 * Returns true if the hash does NOT look like a bcrypt hash.
 */
export function needsRehash(hash: string): boolean {
  return !hash.startsWith('$2');
}