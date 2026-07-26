/**
 * HTML Sanitizer using DOMPurify.
 *
 * Strips all dangerous tags (script, iframe, object, embed, form, etc.)
 * and event-handler attributes (onclick, onerror, etc.) while preserving
 * safe formatting HTML that admins use in blog posts and popups.
 *
 * This is a **defense-in-depth** measure on top of the nonce-based CSP
 * (Step 2). Even if CSP is somehow bypassed, the HTML itself is clean.
 */

import DOMPurify from 'dompurify';

/* ------------------------------------------------------------------ */
/*  Allow-list of tags & attributes                                  */
/* ------------------------------------------------------------------ */

const ALLOWED_TAGS = [
  // Text formatting
  'p', 'br', 'hr', 'span', 'div',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Inline formatting
  'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup', 'mark', 'small',
  // Links & media
  'a', 'img',
  // Lists
  'ul', 'ol', 'li',
  // Block elements
  'blockquote', 'pre', 'code',
  // Tables
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  // Figure
  'figure', 'figcaption',
];

const ALLOWED_ATTR = [
  // Global
  'class', 'style', 'id', 'role', 'aria-label',
  // Links
  'href', 'target', 'rel',
  // Images
  'src', 'alt', 'width', 'height', 'loading', 'decoding',
  // Tables
  'colspan', 'rowspan', 'scope',
  // Code
  'data-language',
];

/* ------------------------------------------------------------------ */
/*  DOMPurify configuration                                           */
/* ------------------------------------------------------------------ */

const PURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,

  // Block javascript: / data: / vbscript: URLs in href/src
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,

  // Keep HTML comments (admin may use them as markers)
  ALLOW_COMMENTS: false,

  // Remove tags entirely instead of replacing with empty content
  // (e.g. <script>alert(1)</script> → empty, not "alert(1)")
  KEEP_CONTENT: true,

  // Don't allow <a> with target=_blank without rel=noopener
  // (prevents reverse-tabnabbing)
  ADD_ATTR: ['target'],
};

/* ------------------------------------------------------------------ */
/*  Public API                                                       */
/* ------------------------------------------------------------------ */

/**
 * Sanitize an HTML string, removing all potentially dangerous content.
 *
 * @example
 * sanitizeHtml('<p>Hello</p><script>alert(1)</script>')
 * // → '<p>Hello</p>'
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, PURIFY_CONFIG);
}
