import { NextRequest, NextResponse } from 'next/server';
import { getOAuthClient, getClientSecret } from '@/lib/oauth/clients';
import { verifyPkceS256, safeEqual } from '@/lib/oauth/crypto';
import {
  consumeAuthorizationCode,
  issueAccessToken,
  oauthDebug,
  ACCESS_TOKEN_TTL_S,
} from '@/lib/oauth/service';

/**
 * ─────────────────────────────────────────────────────────────────
 * POST /api/oauth/token — OAuth 2.0 Token Endpoint (server-to-server)
 * ─────────────────────────────────────────────────────────────────
 *
 * Exchanges a single-use authorization code for a short-lived
 * bearer access token. Called by the Verify SERVER, never the
 * browser.
 *
 * Validates (RFC 6749 §4.1.3 + RFC 7636 §4.6):
 *   - grant_type=authorization_code
 *   - client_id + client_secret (confidential client, constant-time)
 *   - code exists, not already used, not expired
 *   - redirect_uri matches the authorize request exactly
 *   - PKCE S256 code_verifier matches the stored challenge
 *
 * Responses carry Cache-Control: no-store. Codes/tokens/secrets are
 * never logged. Error format follows RFC 6749 §5.2.
 */

export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const;

function oauthError(error: string, description?: string, status = 400) {
  return NextResponse.json(
    { error, ...(description ? { error_description: description } : {}) },
    { status, headers: noStore }
  );
}

interface RequestParams {
  [k: string]: string
}

async function parseParams(req: NextRequest): Promise<RequestParams> {
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      const body = (await req.json()) as Record<string, unknown>
      const out: RequestParams = {}
      for (const [k, v] of Object.entries(body)) {
        if (typeof v === 'string') out[k] = v
      }
      return out
    } catch {
      return {}
    }
  }
  // Default: application/x-www-form-urlencoded (RFC 6749 §4.1.3)
  const out: RequestParams = {}
  try {
    const form = await req.formData()
    for (const [k, v] of form.entries()) {
      if (typeof v === 'string') out[k] = v
    }
  } catch {
    /* fallthrough — missing params handled below */
  }
  return out
}

export async function POST(req: NextRequest) {
  const params = await parseParams(req);
  oauthDebug('token_request', {
    client_id: params.client_id ?? null,
    grant_type: params.grant_type ?? null,
    redirect_uri_present: !!params.redirect_uri,
    verifier_present: !!params.code_verifier,
    content_type: (req.headers.get('content-type') ?? '').split(';')[0],
  });

  // ── 1) grant_type ──
  if (params.grant_type !== 'authorization_code') {
    return oauthError('unsupported_grant_type', 'only authorization_code is supported');
  }

  // ── 2) Confidential client authentication (constant-time) ──
  const client = getOAuthClient(params.client_id);
  if (!client) {
    oauthDebug('client_auth_failed', { reason: 'unknown_client' });
    return oauthError('invalid_client', 'unknown client', 401);
  }
  const expectedSecret = getClientSecret(client);
  if (!expectedSecret) {
    // Server misconfiguration — fail closed, never echo the reason.
    console.error(`[oauth/token] env ${client.secretEnvVar} is not set or too short`);
    oauthDebug('client_auth_failed', { reason: 'client_secret_env_missing' });
    return oauthError('server_error', undefined, 500);
  }
  if (!params.client_secret) {
    oauthDebug('client_auth_failed', { reason: 'secret_not_provided' });
    return oauthError('invalid_client', 'client authentication required', 401);
  }
  if (!safeEqual(params.client_secret, expectedSecret)) {
    oauthDebug('client_auth_failed', { reason: 'secret_mismatch' });
    return oauthError('invalid_client', 'client authentication failed', 401);
  }

  // ── 3) Code parameter ──
  if (!params.code || params.code.length > 512) {
    return oauthError('invalid_request', 'code is required');
  }

  // ── 4) Consume the code (single-use, bindings checked) ──
  const result = await consumeAuthorizationCode({
    code: params.code,
    clientId: client.id,
    redirectUri: params.redirect_uri,
  });

  if (!result.ok) {
    // Uniform invalid_grant — never leak which check failed.
    oauthDebug('code_validation', { result: result.reason });
    return oauthError('invalid_grant', 'authorization code is invalid, expired, or already used');
  }

  // ── 5) PKCE verification (code already consumed → no retry probing) ──
  if (!params.code_verifier || !verifyPkceS256(params.code_verifier, result.row.codeChallenge)) {
    oauthDebug('code_validation', { result: 'pkce_failed' });
    return oauthError('invalid_grant', 'PKCE verification failed');
  }

  // ── 6) Issue the short-lived identity access token ──
  const accessToken = issueAccessToken({
    sub: result.row.userId,
    scope: result.row.scope.split(' ').filter(Boolean),
    clientId: client.id,
  });
  if (!accessToken) {
    console.error('[oauth/token] OAUTH_SECRET is missing or too short');
    oauthDebug('token_error', { reason: 'oauth_secret_missing' });
    return oauthError('server_error', undefined, 500);
  }

  oauthDebug('code_validation', { result: 'ok' });
  oauthDebug('token_issued', { client_id: client.id, scope: result.row.scope, expires_in: ACCESS_TOKEN_TTL_S });

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_S,
      scope: result.row.scope,
    },
    { headers: noStore }
  );
}
