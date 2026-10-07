import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getOAuthClient } from '@/lib/oauth/clients';
import {
  buildAuthorizeQuery,
  buildRedirectUrl,
  createAuthorizationCode,
  isSameOrigin,
  oauthDebug,
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
  const sameOrigin = isSameOrigin(req);
  oauthDebug('consent_received', { same_origin: sameOrigin });
  if (!sameOrigin) {
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
    oauthDebug('consent_rejected', { reason: 'form_parse_failed' });
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (!consentToken || (decision !== 'continue' && decision !== 'deny')) {
    oauthDebug('consent_rejected', { reason: 'missing_fields', decision, token_present: !!consentToken });
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // ── 3) Verify the signed consent token ──
  const payload = verifyConsentToken(consentToken);
  if (!payload) {
    // Expired / tampered / wrong site — send back through authorize
    oauthDebug('consent_rejected', { reason: 'consent_token_invalid' });
    return NextResponse.json({ error: 'invalid_request', error_description: 'consent token invalid or expired' }, { status: 403 });
  }
  oauthDebug('consent_token_valid', { client_id: payload.cid, decision });

  // ── 4) Session must still belong to the same user ──
  const sessionUserId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionUserId || sessionUserId !== payload.sub) {
    // Session lost/changed mid-consent → re-run the authorize flow
    // (NextResponse.redirect requires ABSOLUTE URLs)
    oauthDebug('session_mismatch', { session_present: !!sessionUserId });
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
      // 303 See Other — REQUIRED: converts the consent form POST into a
      // GET so the error response is delivered as an authorization-response
      // query per RFC 6749 §4.1.2. Without it NextResponse.redirect
      // defaults to 307, which re-POSTs the form body to the client.
      buildRedirectUrl(payload.rid, { error: 'access_denied', state: payload.st }),
      303
    );
    res.headers.set('Cache-Control', 'no-store');
    oauthDebug('redirect_sent', { kind: 'deny', status: 303, redirect_host: safeHost(payload.rid) });
    return res;
  }

  // ── 6) Continue → re-verify client registration (defense-in-depth) ──
  const client = getOAuthClient(payload.cid);
  if (!client || !client.redirectUris.includes(payload.rid)) {
    // Registered config changed mid-flow — do not issue anything.
    oauthDebug('client_reconfigured', { client_found: !!client });
    const res = NextResponse.redirect(
      // 303 — same rationale as the deny branch above.
      buildRedirectUrl(payload.rid, { error: 'server_error', state: payload.st }),
      303
    );
    res.headers.set('Cache-Control', 'no-store');
    oauthDebug('redirect_sent', { kind: 'server_error', status: 303, redirect_host: safeHost(payload.rid) });
    return res;
  }

  // ── 7) Ensure the user still exists and is active ──
  const user = await db.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, isActive: true },
  });
  if (!user || !user.isActive) {
    oauthDebug('user_inactive', {});
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
  oauthDebug('code_generated', { client_id: client.id, code_len: code.length });

  const res = NextResponse.redirect(
    // 303 See Other — THE authorization response. This MUST switch the
    // user-agent from the consent form POST to a GET of the client's
    // registered redirect URI (RFC 6749 §4.1.2). NextResponse.redirect
    // defaults to 307, which PRESERVES method + body: the browser would
    // re-POST the consent form (consent_token included) to the client
    // callback instead of GETting it — the flow stalls there and the
    // client never receives the code as a query parameter.
    buildRedirectUrl(payload.rid, { code, state: payload.st }),
    303
  );
  res.headers.set('Cache-Control', 'no-store');
  oauthDebug('redirect_sent', { kind: 'code', status: 303, redirect_host: safeHost(payload.rid) });
  return res;
}

/** TEMPORARY debug helper — registered redirect host only, never the raw URI. */
function safeHost(redirectUri: string): string | null {
  try {
    return new URL(redirectUri).host;
  } catch {
    return null;
  }
}

export const runtime = 'nodejs';
