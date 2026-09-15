import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const r2 = new S3Client({
  region: 'auto',
  // R2_ENDPOINT override exists for local E2E against a fake S3 server;
  // production always uses the standard R2 endpoint.
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  // Path-style addressing (bucket in the path) — deterministic presigned URLs
  // and Cloudflare R2's recommended style.
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

export const R2_BUCKET = process.env.R2_BUCKET_NAME || 'midman-storage'
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''

/** Validate that R2 is properly configured. Call at the start of upload APIs. */
export function assertR2Configured(): void {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
    throw new Error('R2 credentials are not configured')
  }
  if (!R2_PUBLIC_URL) {
    console.error('[R2] WARNING: R2_PUBLIC_URL is not set. Uploaded files will not be publicly accessible.')
  }
}

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function uploadToR2(
  file: File,
  prefix: string = 'products'
): Promise<{ url: string; key: string }> {
  assertR2Configured()

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('আপলোডের জন্য JPEG, PNG, WebP অথবা GIF ফাইল হতে হবে')
  }

  if (file.size > MAX_SIZE) {
    throw new Error('ফাইল সর্বোচ্চ 2MB হতে পারবে')
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const key = `${prefix}/${timestamp}-${random}.${ext}`

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: file.type,
    // Immutable forever: keys are unique per upload (timestamp-random), so a
    // URL's content never changes. This lets Cloudflare edge-cache the object
    // (cf-cache-status: HIT) and browsers keep it for a year — repeat views
    // stop re-downloading through the Vercel /cdn/ proxy, cutting transfer.
    CacheControl: 'public, max-age=31536000, immutable',
  }))

  if (!R2_PUBLIC_URL) {
    throw new Error('R2 public URL is not configured. Set R2_PUBLIC_URL environment variable.')
  }

  // Return proxy URL so images load as same-origin (fixes Brave Shields)
  const proxyUrl = `/cdn/${key}`
  const publicUrl = `${R2_PUBLIC_URL}/${key}`
  console.error('[R2] Upload success:', publicUrl)

  return { url: proxyUrl, key }
}

/** Extract R2 key from a URL — handles both proxied (/cdn/profiles/123.jpg) and direct (https://cdn.midman.bd/profiles/123.jpg) URLs */
function urlToKey(url: string): string | null {
  // Proxied URL: /cdn/profiles/123.jpg → profiles/123.jpg
  if (url.startsWith('/cdn/')) {
    return url.slice(5) // remove "/cdn/"
  }
  // Direct CDN URL
  const base = R2_PUBLIC_URL || ''
  if (base && url.startsWith(base + '/')) {
    return url.slice(base.length + 1)
  }
  return null
}

/** Delete a file from R2 by its public URL. Silently ignores if not found. */
export async function deleteFromR2(url: string): Promise<void> {
  const key = urlToKey(url)
  if (!key) return
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  } catch {
    // ignore — DB cleanup is the source of truth
  }
}

/* ═══════════════════════════════════════════════════════════
   Digital product files (PDF / ZIP / DOC …)
   — stored under `files/<userId>/…` and served ONLY through
   time-limited presigned URLs (never the public CDN domain).
   ═══════════════════════════════════════════════════════════ */

const ALLOWED_FILE_EXTS = new Set([
  'pdf', 'zip', 'rar', '7z',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
  'epub', 'mobi',
  'mp3', 'mp4', 'wav',
  'psd', 'ai', 'fig', 'sketch',
  'apk',
  'png', 'jpg', 'jpeg', 'webp',
])

export const MAX_DIGITAL_FILE_SIZE = 100 * 1024 * 1024 // 100MB

/** Validate a digital file's name/extension + size. Returns the safe extension. */
export function validateDigitalFile(fileName: string, fileSize: number): { ext: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (!ext || !ALLOWED_FILE_EXTS.has(ext)) {
    throw new Error('এই ফাইল ফরম্যাট সাপোর্ট করা হয় না (PDF, ZIP, DOC, MP4 ইত্যাদি ব্যবহার করুন)')
  }
  if (fileSize <= 0) throw new Error('ফাইল খালি হতে পারবে না')
  if (fileSize > MAX_DIGITAL_FILE_SIZE) throw new Error('ফাইল সর্বোচ্চ 100MB হতে পারবে')
  return { ext }
}

/** Build the R2 key for a digital file — embeds the uploader's id so ownership is verifiable. */
export function digitalFileKey(userId: string, ext: string): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0')).join('') // 16-char secret
  return `files/${userId}/${Date.now()}-${rand}.${ext}`
}

/** True when the given R2 key belongs to the given uploader (`files/<userId>/…`). */
export function ownsFileKey(key: string, userId: string): boolean {
  return key.startsWith(`files/${userId}/`) && /^[\w./-]+$/.test(key) && !key.includes('..')
}

/**
 * Presigned PUT URL — the browser uploads the file DIRECTLY to R2,
 * bypassing the 4.5MB serverless body limit.
 */
export async function presignUpload(key: string): Promise<string> {
  assertR2Configured()
  const cmd = new PutObjectCommand({ Bucket: R2_BUCKET, Key: key })
  return getSignedUrl(r2, cmd, { expiresIn: 600 })
}

/**
 * Presigned GET URL that forces an attachment download with the
 * buyer-friendly filename. Only issued after an entitlement check.
 */
export async function presignDownload(key: string, fileName: string, fileType?: string | null): Promise<string> {
  assertR2Configured()
  // Content-Disposition safe filename (ASCII fallback + RFC 5987 for unicode)
  const safe = fileName.replace(/[\r\n"\\/\u0000-\u001f]/g, '_').trim() || 'download'
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_')
  const encoded = encodeURIComponent(safe)
  const cmd = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`,
    ...(fileType ? { ResponseContentType: fileType } : {}),
  })
  return getSignedUrl(r2, cmd, { expiresIn: 600 })
}

/** Delete a digital file by its R2 key (best-effort). */
export async function deleteFileByKey(key: string): Promise<void> {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  } catch {
    // ignore
  }
}

let _corsEnsured = false
/**
 * Allow the browser to PUT files straight to R2 (presigned upload).
 *
 * ⚠️ PutBucketCors is a BUCKET-level operation — it needs an R2 token with
 * "Admin Read & Write" permission. With an "Object Read & Write" token it
 * returns AccessDenied, the bucket keeps NO CORS rule and every browser
 * presigned PUT is blocked by the missing preflight response. Server-side
 * PUTs (image upload, direct digital upload) are NOT affected.
 *
 * Returns true when the bucket is confirmed to serve CORS preflights.
 * Idempotent — checked once per server process.
 */
export async function ensureBucketCors(): Promise<boolean> {
  if (_corsEnsured) return true
  // Already configured (e.g. set manually from the Cloudflare dashboard)?
  try {
    const existing = await r2.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET }))
    if (existing?.CORSRules?.length) {
      _corsEnsured = true
      return true
    }
  } catch {
    // No CORS rule (or token lacks read permission) — try to set it below
  }
  try {
    await r2.send(new PutBucketCorsCommand({
      Bucket: R2_BUCKET,
      CORSConfiguration: {
        CORSRules: [{
          AllowedOrigins: ['*'],
          AllowedMethods: ['PUT', 'GET', 'HEAD'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3600,
        }],
      },
    }))
    // Verify it actually stuck
    const check = await r2.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET }))
    if (check?.CORSRules?.length) {
      _corsEnsured = true
      return true
    }
    return false
  } catch (err) {
    console.error('[R2] PutBucketCors failed — presigned BROWSER uploads will fail (server-side uploads still work). Fix: create an R2 token with Admin Read & Write, or set the CORS policy manually in the Cloudflare dashboard:', err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Server-side digital file PUT — no bucket CORS involvement (server → R2).
 * Used by the direct upload fallback for files that fit the serverless body limit.
 */
export async function putDigitalFile(buffer: Buffer, key: string, contentType: string | null): Promise<void> {
  assertR2Configured()
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
    // Keys are unique per upload (timestamp + 16-char secret) — immutable caching is safe
    CacheControl: 'public, max-age=31536000, immutable',
  }))
}
