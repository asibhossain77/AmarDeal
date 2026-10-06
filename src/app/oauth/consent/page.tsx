import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getOAuthClient } from '@/lib/oauth/clients';
import { verifyConsentToken } from '@/lib/oauth/service';
import { OAuthConsent } from '@/components/oauth/consent-screen';
import { OAuthErrorScreen } from '@/components/oauth/error-screen';

/**
 * ─────────────────────────────────────────────────────────────────
 * GET /oauth/consent?ct=<signed consent token> — consent screen page
 * ─────────────────────────────────────────────────────────────────
 *
 * Render-only companion of the /oauth/authorize route handler (all
 * HTTP redirects live there — see the rationale in that file).
 *
 * The signed consent token (`ct`, HMAC, 5-minute TTL) carries the
 * full authorization request binding (user, client, redirect URI,
 * PKCE challenge, state). It is NOT a credential on its own: the
 * consent POST still requires the matching Midman session cookie,
 * and the token never leaves midman.bd. The page fails closed to
 * the error screen for missing/expired/tampered tokens or session
 * mismatches.
 */

export const metadata: Metadata = {
  title: 'Midman দিয়ে সাইন ইন করুন',
  robots: { index: false, follow: false },
};

const SESSION_COOKIE = 'midman_session';

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ ct?: string }>;
}) {
  const { ct } = await searchParams;

  const payload = typeof ct === 'string' ? verifyConsentToken(ct) : null;
  if (!payload) {
    return <OAuthErrorScreen code="invalid_request" />;
  }

  // Session must belong to the same user the token was issued for.
  const sessionUserId = (await cookies()).get(SESSION_COOKIE)?.value;
  const user =
    sessionUserId && sessionUserId === payload.sub
      ? await db.user.findUnique({
          where: { id: sessionUserId },
          select: { id: true, name: true, email: true, imageLink: true, isActive: true },
        })
      : null;

  if (!user || !user.isActive) {
    return <OAuthErrorScreen code="invalid_request" />;
  }

  const client = getOAuthClient(payload.cid);
  if (!client || !client.redirectUris.includes(payload.rid)) {
    return <OAuthErrorScreen code="invalid_client" />;
  }

  const clientHost = new URL(payload.rid).host;

  return (
    <OAuthConsent
      userName={user.name}
      userEmail={user.email}
      userImage={user.imageLink ?? null}
      clientName={client.name}
      clientHost={clientHost}
      scopes={payload.sc}
      consentToken={ct as string}
    />
  );
}
