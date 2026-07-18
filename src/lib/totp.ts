/**
 * TOTP (Time-based One-Time Password) — zero external dependencies.
 * Pure implementation using Node.js built-in crypto module.
 * Compatible with Google Authenticator, Authy, etc.
 */
import { createHmac, randomBytes } from 'crypto'

function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0')
  }
  let result = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    result += alphabet[parseInt(bits.substring(i, i + 5), 2)]
  }
  return result
}

function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of str) {
    const val = alphabet.indexOf(char.toUpperCase())
    if (val === -1) continue
    bits += val.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

export function generateSecret(length = 20): string {
  return base32Encode(randomBytes(length))
}

export function verifyTOTP(token: string, secret: string, window = 1): boolean {
  const key = base32Decode(secret)
  const timeStep = 30
  const now = Math.floor(Date.now() / 1000 / timeStep)

  for (let offset = -window; offset <= window; offset++) {
    const time = now + offset
    const timeBytes = Buffer.alloc(8)
    timeBytes.writeUInt32BE(0, 0)
    timeBytes.writeUInt32BE(time, 4)

    const hmac = createHmac('sha1', key)
    hmac.update(timeBytes)
    const hmacResult = hmac.digest()

    const offset_val = hmacResult[hmacResult.length - 1] & 0x0f
    const binary =
      ((hmacResult[offset_val] & 0x7f) << 24) |
      ((hmacResult[offset_val + 1] & 0xff) << 16) |
      ((hmacResult[offset_val + 2] & 0xff) << 8) |
      (hmacResult[offset_val + 3] & 0xff)

    const otp = (binary % 1000000).toString().padStart(6, '0')
    if (otp === token) return true
  }
  return false
}

// QR code as external URL (no library needed)
export function generateQRDataURL(otpauthUrl: string): string {
  const encoded = encodeURIComponent(otpauthUrl)
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}&margin=10`
}