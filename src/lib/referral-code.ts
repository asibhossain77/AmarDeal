/**
 * Generates a unique referral code for a user.
 * Format: {3-char prefix}-{5-char random}
 * Example: ASI-X7K9M
 *
 * Prefix: First 3 uppercase Latin letters from the user's name.
 * Falls back to "USR" if name has fewer than 3 Latin letters.
 */

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No I, O, 0, 1 to avoid confusion

function randomSegment(length: number): string {
  let result = ''
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  for (let i = 0; i < length; i++) {
    result += CHARS[arr[i] % CHARS.length]
  }
  return result
}

function extractPrefix(name: string): string {
  const latinLetters = name.toUpperCase().match(/[A-Z]/g)
  if (latinLetters && latinLetters.length >= 3) {
    return latinLetters.slice(0, 3).join('')
  }
  if (latinLetters && latinLetters.length > 0) {
    return latinLetters.join('').padEnd(3, 'X').slice(0, 3)
  }
  return 'USR'
}

export function generateReferralCode(name: string): string {
  const prefix = extractPrefix(name)
  const random = randomSegment(5)
  return `${prefix}-${random}`
}

/**
 * Generates a unique referral code, retrying with new random segments
 * if a collision is found in the database.
 */
export async function generateUniqueReferralCode(name: string): Promise<string> {
  const { db } = await import('@/lib/db')

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode(name)
    const existing = await db.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    })
    if (!existing) return code
  }

  // Fallback: use a longer random segment if all 5 attempts collide (extremely unlikely)
  const prefix = extractPrefix(name)
  return `${prefix}-${randomSegment(8)}`
}
