import { db } from '@/lib/db'

/* ═══════════════════════════════════════════════════════════
   PipraPay gateway client (server-only).

   Shared by the Marketplace Direct Order payment routes.
   The existing Deal payment routes keep their own inline
   implementation — this module is additive and does not touch
   the escrow flow.

   Trust model (identical to the deal flow):
   - create-charge: server-to-server POST with the API key header
   - verify: server-to-server POST {pp_id} — the ONLY trusted
     proof that money actually arrived. Redirects, browser
     callbacks and webhook payloads are treated as untrusted
     triggers that at most cause a re-verification.
   ═══════════════════════════════════════════════════════════ */

export interface PipraPayConfig {
  baseUrl: string
  apiKey: string
  enabled: boolean
}

export async function getPipraPayConfig(): Promise<PipraPayConfig | null> {
  const settings = await db.platformSetting.findMany({
    where: { key: { in: ['piprapay_api_key', 'piprapay_base_url', 'piprapay_enabled'] } },
  })
  const map = new Map(settings.map((s) => [s.key, s.value]))
  const apiKey = map.get('piprapay_api_key') || ''
  const baseUrl = (map.get('piprapay_base_url') || 'https://sandbox.piprapay.com').replace(/\/+$/, '')
  const enabled = map.get('piprapay_enabled') === 'true'
  if (!apiKey || !enabled) return null
  return { baseUrl, apiKey, enabled: true }
}

export interface CreateChargeResult {
  ok: true
  invoiceId: string
  redirectUrl: string
}

export interface CreateChargeError {
  ok: false
  error: string
}

/**
 * Create a payment charge on PipraPay.
 * `metadata` is echoed back by the gateway on webhook/verify and is
 * used to correlate the payment with our order.
 */
export async function piprapayCreateCharge(params: {
  fullName: string
  emailMobile: string
  amount: number
  redirectUrl: string
  cancelUrl: string
  webhookUrl: string
  metadata: Record<string, string>
}): Promise<CreateChargeResult | CreateChargeError> {
  const config = await getPipraPayConfig()
  if (!config) return { ok: false, error: 'gateway_disabled' }

  try {
    const res = await fetch(`${config.baseUrl}/api/create-charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'MHS-PIPRAPAY-API-KEY': config.apiKey,
      },
      body: JSON.stringify({
        full_name: params.fullName,
        email_mobile: params.emailMobile,
        amount: String(params.amount),
        redirect_url: params.redirectUrl,
        return_type: 'GET',
        cancel_url: params.cancelUrl,
        webhook_url: params.webhookUrl,
        currency: 'BDT',
        metadata: params.metadata,
      }),
    })

    if (!res.ok) return { ok: false, error: `gateway_error_${res.status}` }
    const data = await res.json()
    if (!data?.redirect_url || !data?.invoice_id) {
      return { ok: false, error: 'gateway_invalid_response' }
    }
    return { ok: true, invoiceId: String(data.invoice_id), redirectUrl: String(data.redirect_url) }
  } catch {
    return { ok: false, error: 'gateway_unreachable' }
  }
}

export interface VerifyPaymentResult {
  ok: boolean
  ppId?: string
  amount?: number
  currency?: string
  status?: string
  senderNumber?: string | null
  paymentMethod?: string | null
  transactionId?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Server-to-server payment verification — the trusted mechanism.
 * Calls PipraPay's verify-payments API with our API key; the gateway's
 * response is the only accepted proof of payment.
 */
export async function piprapayVerifyPayment(ppId: string): Promise<VerifyPaymentResult> {
  const config = await getPipraPayConfig()
  if (!config) return { ok: false }

  try {
    const res = await fetch(`${config.baseUrl}/api/verify-payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'MHS-PIPRAPAY-API-KEY': config.apiKey,
      },
      body: JSON.stringify({ pp_id: ppId }),
    })
    if (!res.ok) return { ok: false }
    const data = await res.json()
    if (!data || typeof data !== 'object') return { ok: false }
    return {
      ok: true,
      ppId: data.pp_id ? String(data.pp_id) : undefined,
      amount: data.amount !== undefined && data.amount !== null ? Number(data.amount) : undefined,
      currency: typeof data.currency === 'string' ? data.currency : undefined,
      status: typeof data.status === 'string' ? data.status : undefined,
      senderNumber: typeof data.sender_number === 'string' ? data.sender_number : null,
      paymentMethod: typeof data.payment_method === 'string' ? data.payment_method : null,
      transactionId: typeof data.transaction_id === 'string' ? data.transaction_id : null,
      metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : undefined,
    }
  } catch {
    return { ok: false }
  }
}

export function piprapayAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || ''
}
