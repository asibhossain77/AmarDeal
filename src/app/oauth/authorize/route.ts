import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getOAuthClient } from '@/lib/oauth/clients';
import { isValidPkceChallenge } from '@/lib/oauth/crypto';
import { buildRedirectUrl, issueConsentToken, parseScope } from '@/lib/oauth/service';

/**
 * ─────────────────────────────────────────────────────────────────
 * GET /oauth/authorize — OAuth 2.0 Authorization Endpoint
 * ─────────────────────────────────────────────────────────────────
 *
 * Implemented as a ROUTE HANDLER (not a page) so every redirect is
 * a real HTTP 302 — required by RFC 6749 §4.1.2.1 and because the
 * root loading.tsx boundary turns page-component redirects into
 * client-side RSC redirects (HTTP 200), which would break OAuth
 * clients. Rendering happens on companion pages:
 *
 *   /oauth/consent?ct=<signed consent token>  → consent screen
 *   /oauth/error?code=<error code>            → rendered error page
 *
 * Supports: client_id, redirect_uri, response_type=code, scope,
 * state, code_challenge, code_challenge_method=S256.
 *
 * 1. Unknown client / unregistered redirect → error page ON midman.bd
 *    (never redirects to an unvalidated destination).
 * 2. Other protocol errors → 302 to the validated redirect_uri with
 *    error + state echoed (RFC 6749 §4.1.2.1).
 * 3. No Midman session → 302 to the existing Midman login page with
 *    a strictly validated return-to, then back here automatically.
 * 4. Session present → 302 to the consent screen (no password
 *    re-prompt). The session cookie never leaves midman.bd.
 */

export const runtime = 'nodejs';

const SESSION_COOKIE = 'midman_session';

interface RawAuthorizeParams {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

function toInternal(req: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, req.url), 302);
}

export async function GET(req: NextRequest) {
  const sp: RawAuthorizeParams = Object.fromEntries(
    new URL(req.url).searchParams.entries()
  ) as RawAuthorizeParams;

  // ── 1) Registered client only ──
  const client = getOAuthClient(sp.client_id);
  if (!client) {
    return toInternal(req, '/oauth/error?code=invalid_client');
  }

  // ── 2) Exact-match redirect URI, fail closed ──
  if (!sp.redirect_uri || !client.redirectUris.includes(sp.redirect_uri)) {
    return toInternal(req, '/oauth/error?code=invalid_redirect');
  }

  // Client + redirect are now validated → protocol errors are
  // redirected back to the client app per RFC 6749 §4.1.2.1.
  const errRedirect = (error: string): NextResponse =>
    NextResponse.redirect(
      buildRedirectUrl(sp.redirect_uri as string, { error, state: sp.state ?? '' }),
      302
    );

  // ── 3) response_type ──
  if (sp.response_type !== 'code') {
    return errRedirect('unsupported_response_type');
  }

  // ── 4) scope: non-empty subset of {openid, profile, email} ──
  const scope = parseScope(sp.scope);
  if (!scope) {
    return errRedirect('invalid_scope');
  }

  // ── 5) PKCE S256 required (defense against code interception) ──
  if (!sp.code_challenge || !isValidPkceChallenge(sp.code_challenge)) {
    return errRedirect('invalid_request');
  }
  const codeChallengeMethod = sp.code_challenge_method ?? 'S256';
  if (codeChallengeMethod !== 'S256') {
    return errRedirect('invalid_request');
  }

  // ── 6) state sanity cap (echoed verbatim, still bounded) ──
  const state = sp.state ?? '';
  if (state.length > 1024) {
    return errRedirect('invalid_request');
  }

  // ── 7) Existing Midman session? ──
  const sessionUserId = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = sessionUserId
    ? await db.user.findUnique({
        where: { id: sessionUserId },
        select: { id: true, isActive: true },
      })
    : null;

  if (!user || !user.isActive) {
    // Not logged in → existing Midman login page, then return here.
    // `next` is strictly validated by isValidReturnTo() after login.
    const returnTo =
      '/oauth/authorize?' +
      new URLSearchParams({
        client_id: sp.client_id as string,
        redirect_uri: sp.redirect_uri as string,
        response_type: 'code',
        scope: (scope as string[]).join(' '),
        state,
        code_challenge: sp.code_challenge as string,
        code_challenge_method: codeChallengeMethod,
      }).toString();
    return toInternal(req, '/login?next=' + encodeURIComponent(returnTo));
  }

  // ── 8) Issue the CSRF-bound consent token and show the consent UI ──
  const consentToken = issueConsentToken({
    sub: user.id,
    clientId: client.id,
    redirectUri: sp.redirect_uri as string,
    scope: scope as string[],
    codeChallenge: sp.code_challenge as string,
    codeChallengeMethod,
    state,
  });
  if (!consentToken) {
    // Provider misconfiguration (OAUTH_SECRET missing) — fail closed.
    // Distinct from invalid_request: the CLIENT request already passed every
    // validation above; this is a server-side configuration problem.
    console.error('[oauth/authorize] OAUTH_SECRET is missing or too short — consent disabled');
    return toInternal(req, '/oauth/error?code=server_error');
  }

  const res = toInternal(req, '/oauth/consent?ct=' + encodeURIComponent(consentToken));
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
