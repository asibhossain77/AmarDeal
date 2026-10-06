import type { Metadata } from 'next';
import { OAuthErrorScreen, type OAuthErrorCode } from '@/components/oauth/error-screen';

/**
 * ─────────────────────────────────────────────────────────────────
 * GET /oauth/error?code=<code> — OAuth authorization error page
 * ─────────────────────────────────────────────────────────────────
 *
 * Render-only companion of the /oauth/authorize route handler.
 * Shown ON midman.bd when a request cannot be safely redirected
 * (unknown client_id, unregistered redirect_uri, misconfiguration).
 * The browser is NEVER redirected to an unvalidated destination.
 */

export const metadata: Metadata = {
  title: 'অনুমোদনে সমস্যা',
  robots: { index: false, follow: false },
};

const VALID_CODES: OAuthErrorCode[] = ['invalid_client', 'invalid_redirect', 'invalid_scope', 'invalid_request'];

export default async function OAuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const safeCode = VALID_CODES.includes(code as OAuthErrorCode) ? (code as OAuthErrorCode) : 'invalid_request';
  return <OAuthErrorScreen code={safeCode} />;
}
