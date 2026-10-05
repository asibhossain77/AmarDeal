'use client';

/* ═══════════════════════════════════════════════════════════
   LinkifyText — renders plain text with URLs turned into safe,
   clickable links. Used by the Deal Terms cards (buyer + seller
   trackers) and the deal chat message bubbles.

   Requirements covered:
   • Detects https://… , http://… and www.… URLs
   • Renders them as clickable links that open in a new tab
   • The original URL text stays visible exactly as typed
   • Normal text is never turned into a link

   XSS safety (safe by construction — no HTML string anywhere):
   • Detection only matches text that starts with https://,
     http:// or www. → javascript:/data:/vbscript: schemes can
     never become links.
   • Every candidate is re-parsed with the URL API and rejected
     (rendered as plain text) unless the result is http/https.
   • Output is React elements (auto-escaped), never
     dangerouslySetInnerHTML → no HTML/script injection possible.
   • Links open in a new tab with rel="noopener noreferrer nofollow".
   ═══════════════════════════════════════════════════════════ */

import { Fragment, useMemo } from 'react';

/* ── URL detection ──
   Body chars: everything except whitespace, angle brackets and
   quotes (quotes can't be part of a sane URL, and stopping early
   keeps surrounding HTML-ish text inert). */
const URL_BODY_SRC = String.raw`[^\s<>"']+`;
const URL_RE = new RegExp(`\\b(?:https?://${URL_BODY_SRC}|www\\.${URL_BODY_SRC})`, 'gi');

/* Sentence punctuation that usually follows a URL rather than
   being part of it: . , ; : ! ? curly quotes and the Bengali
   dandi (।) / double dandi (॥). */
const TRAILING_PUNCT = '.,;:!?\u201d\u2019\u0964\u0965';

/**
 * Trim sentence punctuation and unbalanced closing brackets off the
 * end of a raw URL match. Balanced brackets stay (Wikipedia-style
 * …/Foo_(bar) links keep their parenthesis).
 */
function splitTrailing(raw: string): { url: string; trailing: string } {
  let end = raw.length;
  for (;;) {
    const ch = raw[end - 1];
    if (TRAILING_PUNCT.includes(ch)) {
      end--;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      const open = ch === ')' ? '(' : ch === ']' ? '[' : '{';
      const head = raw.slice(0, end);
      /* Strip only while closers outnumber openers inside the URL. */
      if (head.split(ch).length - 1 > head.split(open).length - 1) {
        end--;
        continue;
      }
    }
    break;
  }
  return { url: raw.slice(0, end), trailing: raw.slice(end) };
}

/**
 * Validate + normalize a candidate URL. `www.` gets an https scheme
 * prepended. Returns an http/https href, or null when the candidate
 * must stay plain text (invalid URL / non-http(s) scheme).
 */
function toSafeHref(candidate: string): string | null {
  const withScheme = /^www\./i.test(candidate) ? `https://${candidate}` : candidate;
  try {
    const parsed = new URL(withScheme);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export interface LinkifyToken {
  kind: 'text' | 'link';
  /** Verbatim text run, or the visible URL label for links. */
  value: string;
  /** Sanitized absolute http(s) URL — only present for links. */
  href?: string;
}

/**
 * Split text into verbatim text runs and sanitized link tokens.
 * Exported for testing.
 */
export function tokenizeUrlText(input: string): LinkifyToken[] {
  if (!input) return [];
  const tokens: LinkifyToken[] = [];
  let cursor = 0;
  for (const match of input.matchAll(URL_RE)) {
    const start = match.index;
    const raw = match[0];
    if (start > cursor) tokens.push({ kind: 'text', value: input.slice(cursor, start) });
    const { url, trailing } = splitTrailing(raw);
    const href = toSafeHref(url);
    if (href) {
      tokens.push({ kind: 'link', value: url, href });
      if (trailing) tokens.push({ kind: 'text', value: trailing });
    } else {
      /* Unparseable candidate → keep the whole raw match as plain text. */
      tokens.push({ kind: 'text', value: raw });
    }
    cursor = start + raw.length;
  }
  if (cursor < input.length) tokens.push({ kind: 'text', value: input.slice(cursor) });
  return tokens;
}

export type LinkifyVariant = 'default' | 'accent' | 'amber' | 'purple';

/* Color context classes (defined in globals.css):
   default → site primary (parrot green) on cards/muted backgrounds,
   accent  → white, on the sender's own green chat bubble,
   amber   → on amber system bubbles,
   purple  → on purple admin bubbles. */
const VARIANT_CLASS: Record<LinkifyVariant, string> = {
  default: '',
  accent: 'linkify-link--accent',
  amber: 'linkify-link--amber',
  purple: 'linkify-link--purple',
};

/**
 * Renders `text` with detected URLs as safe clickable links.
 * Inline component — drop it inside any existing <p>/<div> and the
 * surrounding typography is inherited unchanged.
 */
export function LinkifyText({
  text,
  variant = 'default',
  className,
}: {
  text: string;
  variant?: LinkifyVariant;
  className?: string;
}) {
  const tokens = useMemo(() => tokenizeUrlText(text), [text]);
  return (
    <>
      {tokens.map((token, i) =>
        token.kind === 'link' ? (
          <a
            key={i}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={`linkify-link${VARIANT_CLASS[variant] ? ` ${VARIANT_CLASS[variant]}` : ''}${className ? ` ${className}` : ''}`}
          >
            {token.value}
          </a>
        ) : (
          <Fragment key={i}>{token.value}</Fragment>
        ),
      )}
    </>
  );
}
