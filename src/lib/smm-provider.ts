/* ═══════════════════════════════════════════════════════════
   Optional SMM provider API client (server-only).

   Speaks the de-facto standard "SMM panel API v2" contract:
     POST {apiUrl}
     key={api_key}&action=add&service={id}&link={url}&quantity={qty}
     → { order: 123 } | { error: "..." }

     POST {apiUrl}
     key={api_key}&action=status&order={id}
     → { status: "In progress", start_count: "100", remains: "900" } | { error: "..." }

   Configuration lives in PlatformSetting (server-side only, the
   API key is NEVER returned to the browser):
     mp_provider_name      – display name
     mp_provider_api_url   – provider endpoint
     mp_provider_api_key   – provider secret
     mp_provider_enabled   – "true" once configured

   Failure policy: every function returns a discriminated result.
   Callers must NOT mark an order completed merely because the
   provider accepted it, and provider errors must leave the
   order in its current state with an error recorded.
   ═══════════════════════════════════════════════════════════ */

import { db } from '@/lib/db'

export interface ProviderConfig {
  name: string
  apiUrl: string
  apiKey: string
  enabled: boolean
}

export async function getProviderConfig(): Promise<ProviderConfig | null> {
  const settings = await db.platformSetting.findMany({
    where: {
      key: { in: ['mp_provider_name', 'mp_provider_api_url', 'mp_provider_api_key', 'mp_provider_enabled'] },
    },
  })
  const map = new Map(settings.map((s) => [s.key, s.value]))
  const apiUrl = (map.get('mp_provider_api_url') || '').trim()
  const apiKey = (map.get('mp_provider_api_key') || '').trim()
  const enabled = map.get('mp_provider_enabled') === 'true'
  if (!apiUrl || !apiKey || !enabled) return null
  return {
    name: map.get('mp_provider_name') || 'Provider',
    apiUrl,
    apiKey,
    enabled: true,
  }
}

export type ProviderSubmitResult =
  | { ok: true; providerOrderId: string }
  | { ok: false; error: string }

export async function providerSubmitOrder(params: {
  providerServiceId: string
  link: string
  quantity: number
}): Promise<ProviderSubmitResult> {
  const config = await getProviderConfig()
  if (!config) return { ok: false, error: 'provider_not_configured' }

  try {
    const body = new URLSearchParams({
      key: config.apiKey,
      action: 'add',
      service: params.providerServiceId,
      link: params.link,
      quantity: String(params.quantity),
    })
    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) return { ok: false, error: `provider_http_${res.status}` }
    const data = await res.json()
    if (data && typeof data === 'object' && data.order !== undefined && data.order !== null) {
      return { ok: true, providerOrderId: String(data.order) }
    }
    const msg = data && typeof data === 'object' && typeof data.error === 'string' ? data.error : 'provider_invalid_response'
    return { ok: false, error: msg }
  } catch {
    return { ok: false, error: 'provider_unreachable' }
  }
}

export interface ProviderStatusInfo {
  status?: string
  startCount?: number | null
  remains?: number | null
}

export type ProviderSyncResult =
  | ({ ok: true } & ProviderStatusInfo)
  | { ok: false; error: string }

/** Map common provider status strings to our order statuses (informational only). */
export function mapProviderStatus(raw: string): string | null {
  const s = raw.toLowerCase()
  if (s.includes('complet')) return 'completed'
  if (s.includes('partial')) return 'partial'
  if (s.includes('cancel')) return 'cancelled'
  if (s.includes('progress') || s.includes('active')) return 'in_progress'
  if (s.includes('process')) return 'processing'
  if (s.includes('pending')) return 'queued'
  return null
}

export async function providerSyncOrder(providerOrderId: string): Promise<ProviderSyncResult> {
  const config = await getProviderConfig()
  if (!config) return { ok: false, error: 'provider_not_configured' }

  try {
    const body = new URLSearchParams({
      key: config.apiKey,
      action: 'status',
      order: providerOrderId,
    })
    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) return { ok: false, error: `provider_http_${res.status}` }
    const data = await res.json()
    if (data && typeof data === 'object' && typeof data.status === 'string') {
      const startCount =
        data.start_count !== undefined && data.start_count !== null && !Number.isNaN(Number(data.start_count))
          ? Number(data.start_count)
          : null
      const remains =
        data.remains !== undefined && data.remains !== null && !Number.isNaN(Number(data.remains))
          ? Number(data.remains)
          : null
      return { ok: true, status: data.status, startCount, remains }
    }
    const msg = data && typeof data === 'object' && typeof data.error === 'string' ? data.error : 'provider_invalid_response'
    return { ok: false, error: msg }
  } catch {
    return { ok: false, error: 'provider_unreachable' }
  }
}
