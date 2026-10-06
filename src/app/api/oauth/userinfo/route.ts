import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAccessToken } from '@/lib/oauth/service';

/**
 * ─────────────────────────────────────────────────────────────────
 * GET /oauth/userinfo — OIDC-style identity endpoint
 * ─────────────────────────────────────────────────────────────────
 *
 * Returns the minimal identity claims for a valid, unexpired
 * bearer access token issued by /api/oauth/token:
 *
 *   {
 *     "sub": "<stable Midman user id>",
 *     "name": "<display name>",        // scope: profile
 *     "email": "<email>",              // scope: email
 *     "picture": "<profile image>"     // scope: profile (nullable)
 *   }
 *
 * `sub` is the stable Midman user ID — the only field Verify may
 * treat as a permanent key. Claims outside the granted scope are
 * omitted entirely. No wallet, deal, payment, or private data is
 * ever returned here.
 *
 * Calls are server-to-server (Verify backend); no CORS headers are
 * issued on purpose so tokens can never be used from a browser.
 */

export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const;

function unauthorized(description: string) {
  return NextResponse.json(
    { error: 'invalid_token', error_description: description },
    { status: 401, headers: { ...noStore, 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'bearer token required' },
      { status: 401, headers: { ...noStore, 'WWW-Authenticate': 'Bearer' } }
    );
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyAccessToken(token);
  if (!payload) {
    return unauthorized('token is invalid or expired');
  }

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, imageLink: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return unauthorized('account is no longer active');
  }

  const claims: Record<string, string | null> = { sub: user.id };

  if (payload.sc.includes('profile')) {
    claims.name = user.name;
    // Absolute URL on purpose: this response is consumed server-side
    // by the Verify backend (the /cdn proxy path is same-origin only).
    claims.picture = user.imageLink ?? null;
  }
  if (payload.sc.includes('email')) {
    claims.email = user.email;
  }

  return NextResponse.json(claims, { headers: noStore });
}
