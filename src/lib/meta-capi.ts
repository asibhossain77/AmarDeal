import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { DEFAULT_META_PIXEL_ID } from './meta-pixel-id';

/**
 * Meta Conversions API (CAPI) — server-side event sender.
 *
 * Env:
 *  - META_PIXEL_ID (or NEXT_PUBLIC_META_PIXEL_ID)  – the ad account pixel id
 *  - META_CAPI_ACCESS_TOKEN                        – system-user access token
 *  - META_CAPI_TEST_EVENT_CODE (optional)          – routes events to Meta's
 *    Test Events tool while validating the setup
 *  - META_CAPI_URL (optional)                      – graph API base override
 *    (local E2E testing against a mock collector; defaults to v21.0)
 *
 * Design rules:
 *  - NEVER throws: callers do `void sendMetaEvent(...)` / `.catch(() => {})`
 *    — analytics must not break deal, payment or auth flows.
 *  - Events paired with a browser Pixel event MUST carry the SAME event_id
 *    (Meta deduplicates on event_id + event_name within 48 h).
 *  - User identities (email/phone/external_id) MUST be hashed with SHA-256
 *    (lowercased + trimmed) — this module does it for you.
 */

const PIXEL_ID =
  process.env.META_PIXEL_ID?.trim() ||
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ||
  DEFAULT_META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || '';
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE || '';
const GRAPH_BASE = process.env.META_CAPI_URL || 'https://graph.facebook.com/v21.0';

export function metaCapiEnabled(): boolean {
  return Boolean(PIXEL_ID && ACCESS_TOKEN);
}

/** SHA-256 with Meta's normalization (trim + lowercase) */
export function metaHash(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase(), 'utf8').digest('hex');
}

export interface MetaUserData {
  em?: string; // hashed email
  ph?: string; // hashed phone
  external_id?: string; // hashed user id
  client_ip_address?: string;
  client_user_agent?: string;
  fbp?: string; // _fbp cookie (browser pixel sets it)
  fbc?: string; // _fbc cookie (fbclid click)
}

export interface MetaEventInput {
  eventName: string;
  eventId: string;
  userData: MetaUserData;
  customData?: Record<string, unknown>;
  eventSourceUrl?: string;
}

/** Extract IP / UA / fbp / fbc from an incoming request (no hashing here) */
export function metaUserDataFromRequest(req: NextRequest): MetaUserData {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    undefined;
  const ua = req.headers.get('user-agent') || undefined;
  const fbp = req.cookies.get('_fbp')?.value || undefined;
  const fbc = req.cookies.get('_fbc')?.value || undefined;
  return {
    ...(ip ? { client_ip_address: ip } : {}),
    ...(ua ? { client_user_agent: ua } : {}),
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
  };
}

/** Hash known identifiers (email/phone/userId) before sending to Meta */
export function metaHashIdentity(input: {
  email?: string | null;
  phone?: string | null;
  userId?: string | null;
}): Pick<MetaUserData, 'em' | 'ph' | 'external_id'> {
  const out: Pick<MetaUserData, 'em' | 'ph' | 'external_id'> = {};
  if (input.email) out.em = metaHash(input.email);
  if (input.phone) out.ph = metaHash(input.phone);
  if (input.userId) out.external_id = metaHash(input.userId);
  return out;
}

/**
 * Send one event to the Conversions API. Resolves to true when Meta accepted
 * it, false when disabled/failed — never rejects.
 */
export async function sendMetaEvent(input: MetaEventInput): Promise<boolean> {
  try {
    if (!metaCapiEnabled()) return false;

    const payload = {
      data: [
        {
          event_name: input.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: input.eventId,
          action_source: 'website',
          event_source_url: input.eventSourceUrl,
          user_data: input.userData,
          ...(input.customData ? { custom_data: input.customData } : {}),
        },
      ],
      ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
    };

    const res = await fetch(`${GRAPH_BASE}/${PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[META CAPI] ${input.eventName} failed (${res.status}): ${text.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[META CAPI] send error:', err instanceof Error ? err.message : err);
    return false;
  }
}
