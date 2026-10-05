/**
 * SVG logo validation + sanitization for admin brand-logo uploads.
 *
 * Uploaded SVGs are stored in R2 and later served SAME-ORIGIN through the
 * /cdn/ proxy as image/svg+xml. SVG can carry active content (scripts,
 * event handlers, foreignObject-embedded HTML), so everything dangerous is
 * stripped here BEFORE storage — and the /cdn/ proxy additionally sends a
 * script-blocking CSP for SVG responses (defense in depth).
 *
 * Only admins can upload logos (enforced in the route), but sanitization
 * is still mandatory: a compromised/rogue admin session must not be able
 * to plant a stored-XSS payload on every visitor's origin.
 */

/** 512KB — real logo SVGs are 1–20KB; anything bigger is not a logo. */
export const MAX_SVG_LOGO_BYTES = 512 * 1024

const SVG_MIME = 'image/svg+xml'

/** Accept the correct MIME type or a .svg extension (some OS/browser combos send generic MIME). */
export function isSvgFileType(file: { type: string; name: string }): boolean {
  return file.type === SVG_MIME || file.name.toLowerCase().endsWith('.svg')
}

/**
 * Validate + sanitize an uploaded SVG logo.
 * Returns the cleaned SVG text; throws with a Bengali user-safe message
 * (matches the codebase's other upload error strings) on any rejection.
 */
export function sanitizeSvgLogo(raw: string): string {
  const text = raw.trim()

  if (!text) {
    throw new Error('SVG ফাইল খালি হতে পারবে না')
  }
  if (Buffer.byteLength(text, 'utf8') > MAX_SVG_LOGO_BYTES) {
    throw new Error('SVG ফাইল সর্বোচ্চ ৫১২KB হতে পারবে')
  }
  // Must have an <svg> root element (opening tag with attributes or `>`).
  if (!/<svg[\s>]/i.test(text)) {
    throw new Error('এটি বৈধ SVG ফাইল নয় — <svg> এলিমেন্ট পাওয়া যায়নি')
  }

  let out = text
    // XML prolog is harmless but a DOCTYPE can declare entities — drop both.
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    // Entity declarations (billion-laughs / external entity vectors).
    .replace(/<!ENTITY[\s\S]*?>/gi, '')
    // <script> blocks (paired + self-closing).
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script[^>]*\/?\s*>/gi, '')
    // <foreignObject> embeds raw HTML inside SVG — classic XSS vector.
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/<foreignObject[^>]*\/?\s*>/gi, '')
    // Inline event handlers: onclick=, onerror=, onload= … (unquoted too).
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    // Dangerous URL schemes in linkable attributes (data: blocked as a
    // nested-document vector; legit logos reference shapes, not URIs).
    .replace(
      /(href|xlink:href|src|from|to|values|style)\s*=\s*("|\')\s*(javascript|vbscript|data)\s*:[^"\']*\2/gi,
      '$1="#"'
    )
    .replace(/(href|xlink:href|src)\s*=\s*(javascript|vbscript|data)\s*:[^\s>]+/gi, 'href="#"')

  // An SVG rendered inside <img> MUST carry the SVG XML namespace — without
  // it the browser silently renders nothing. Inject it when a design tool
  // omitted it, so the admin immediately sees their logo working.
  if (!/xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(out)) {
    out = out.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
  }

  // A sanitized file must still be an SVG — the aggressive stripping above
  // can, in pathological inputs, remove the root element itself.
  if (!/<svg[\s>]/i.test(out)) {
    throw new Error('SVG ফাইলটি স্যানিটাইজ করার পরে অবৈধ হয়ে গেছে')
  }

  return out
}

/**
 * Full upload validation pipeline for a logo File:
 * type/extension gate → size gate → decode → sanitize.
 * Returns the sanitized SVG text ready for uploadSvgToR2().
 */
export async function validateSvgLogoUpload(file: File): Promise<string> {
  if (!isSvgFileType(file)) {
    throw new Error('শুধুমাত্র SVG ফাইল আপলোড করা যাবে (image/svg+xml)')
  }
  if (file.size === 0) {
    throw new Error('SVG ফাইল খালি হতে পারবে না')
  }
  if (file.size > MAX_SVG_LOGO_BYTES) {
    throw new Error('SVG ফাইল সর্বোচ্চ ৫১২KB হতে পারবে')
  }
  return sanitizeSvgLogo(await file.text())
}
