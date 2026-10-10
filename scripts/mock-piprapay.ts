/**
 * Mock PipraPay gateway for local end-to-end tests.
 * Implements the two endpoints the app calls plus a test-only
 * payment registrar for mismatch/failure scenarios.
 *
 *   POST /api/create-charge   → { invoice_id, redirect_url }
 *   POST /api/verify-payments → completed verify response | 400
 *   POST /test/register       → pre-register a payment {pp_id, amount, metadata}
 *
 * Run: bun scripts/mock-piprapay.ts <port>
 */

const port = Number(process.argv[2] || 4599)

/** invoice_id → { amount, metadata } */
const payments = new Map<string, { amount: string; metadata: Record<string, unknown> }>()
// Unique-per-process prefix so invoice ids never collide with earlier runs
const RUN_PREFIX = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
let seq = 1000

function json(res: unknown, status = 200): Response {
  return new Response(JSON.stringify(res), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

function verifyResponse(ppId: string, rec: { amount: string; metadata: Record<string, unknown> }) {
  return {
    pp_id: ppId,
    customer_name: 'Test Customer',
    customer_email_mobile: 'test@example.com',
    payment_method: 'bKash Personal',
    amount: rec.amount,
    fee: '0',
    refund_amount: '0',
    total: Number(rec.amount),
    currency: 'BDT',
    metadata: rec.metadata,
    sender_number: '01700000000',
    transaction_id: `MOCKTXN${ppId}`,
    status: 'completed',
    date: new Date().toISOString(),
  }
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname === '/api/create-charge' && req.method === 'POST') {
      const body = await readBody(req)
      const invoiceId = `MOCKINV${RUN_PREFIX}${++seq}`
      payments.set(invoiceId, {
        amount: String(body.amount ?? '0'),
        metadata: (body.metadata as Record<string, unknown>) || {},
      })
      return json({ invoice_id: invoiceId, redirect_url: `http://127.0.0.1:${port}/pay/${invoiceId}` })
    }

    if (url.pathname === '/api/verify-payments' && req.method === 'POST') {
      const body = await readBody(req)
      const ppId = String(body.pp_id || '')
      const rec = payments.get(ppId)
      if (!rec) return json({ error: 'payment not found' }, 400)
      return json(verifyResponse(ppId, rec))
    }

    // Test-only registrar — lets the test suite simulate mismatched amounts
    if (url.pathname === '/test/register' && req.method === 'POST') {
      const body = await readBody(req)
      const ppId = String(body.pp_id || '')
      if (!ppId) return json({ error: 'pp_id required' }, 400)
      payments.set(ppId, {
        amount: String(body.amount ?? '0'),
        metadata: (body.metadata as Record<string, unknown>) || {},
      })
      return json({ ok: true })
    }

    if (url.pathname === '/test/reset' && req.method === 'POST') {
      payments.clear()
      return json({ ok: true })
    }

    return json({ error: 'not found' }, 404)
  },
})

console.log(`[mock-piprapay] listening on http://127.0.0.1:${port}`)
