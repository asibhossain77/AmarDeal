import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getOAuthClient } from '@/lib/oauth/clients';
import {
  buildAuthorizeQuery,
  buildRedirectUrl,
  createAuthorizationCode,
  isSameOrigin,
  verifyConsentToken,
} from '@/lib/oauth/service';

/**
 * ─────────────────────────────────────────────────────────────────
 * POST /api/oauth/authorize — consent decision handler
 * ─────────────────────────────────────────────────────────────────
 *
 * Receives the consent form from the consent screen and either:
 *   - decision=continue → issues a short-lived single-use
 *     authorization code and redirects to the client's registered
 *     redirect URI with code + state
 *   - decision=deny → redirects with error=access_denied (+ state)
 *
 * CSRF defenses (layered):
 *   1. SameSite=Lax Midman session cookie (cross-site POSTs carry no session)
 *   2. Same-origin Origin/Host check
 *   3. HMAC-signed consent token bound to user + client + redirect
 *      + PKCE + state with a 5-minute expiry — the posted form
 *      carries NO user/request data, only the signed blob.
 *
 * The session is re-verified before any code is issued.
 */

const SESSION_COOKIE = 'midman_session';

export async function POST(req: NextRequest) {
  // ── 1) Same-origin check ──
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { error: 'forbidden', error_description: 'cross-origin consent rejected' },
      { status: 403 }
    );
  }

  // ── 2) Parse the form ──
  let consentToken = '';
  let decision = '';
  try {
    const form = await req.formData();
    const tokenField = form.get('consent_token');
    const decisionField = form.get('decision');
    if (typeof tokenField === 'string') consentToken = tokenField;
    if (typeof decisionField === 'string') decision = decisionField;
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (!consentToken || (decision !== 'continue' && decision !== 'deny')) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // ── 3) Verify the signed consent token ──
  const payload = verifyConsentToken(consentToken);
  if (!payload) {
    // Expired / tampered / wrong site — send back through authorize
    return NextResponse.json({ error: 'invalid_request', error_description: 'consent token invalid or expired' }, { status: 403 });
  }

  // ── 4) Session must still belong to the same user ──
  const sessionUserId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionUserId || sessionUserId !== payload.sub) {
    // Session lost/changed mid-consent → re-run the authorize flow
    // (NextResponse.redirect requires ABSOLUTE URLs)
    const res = NextResponse.redirect(
      new URL(`/oauth/authorize?${buildAuthorizeQuery(payload)}`, req.url),
      303
    );
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // ── 5) Deny → RFC 6749 §4.1.2.1 access_denied ──
  if (decision === 'deny') {
    const res = NextResponse.redirect(
      buildRedirectUrl(payload.rid, { error: 'access_denied', state: payload.st })
    );
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // ── 6) Continue → re-verify client registration (defense-in-depth) ──
  const client = getOAuthClient(payload.cid);
  if (!client || !client.redirectUris.includes(payload.rid)) {
    // Registered config changed mid-flow — do not issue anything.
    const res = NextResponse.redirect(
      buildRedirectUrl(payload.rid, { error: 'server_error', state: payload.st })
    );
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // ── 7) Ensure the user still exists and is active ──
  const user = await db.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, isActive: true },
  });
  if (!user || !user.isActive) {
    const res = NextResponse.redirect(
      new URL(`/oauth/authorize?${buildAuthorizeQuery(payload)}`, req.url),
      303
    );
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // ── 8) Issue the single-use authorization code ──
  const code = await createAuthorizationCode({
    userId: user.id,
    clientId: client.id,
    redirectUri: payload.rid,
    scope: payload.sc,
    codeChallenge: payload.chal,
    codeChallengeMethod: payload.meth,
  });

  const res = NextResponse.redirect(
    buildRedirectUrl(payload.rid, { code, state: payload.st })
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export const runtime = 'nodejs';
