import { NextResponse } from 'next/server'

const GEMINI_MODEL = 'gemini-3.6-flash'

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY
  const start = Date.now()

  if (!apiKey) {
    return NextResponse.json({
      providers: [{ name: 'Gemini', model: GEMINI_MODEL, status: 'not_configured' as const }],
      activeProvider: 'none',
    })
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'say ok' }] }], generationConfig: { maxOutputTokens: 5 } }),
      }
    )
    const responseTime = Date.now() - start

    if (!res.ok) {
      const errBody = await res.text()
      return NextResponse.json({
        providers: [{ name: 'Gemini', model: GEMINI_MODEL, status: 'error' as const, responseTime, error: `${res.status}: ${errBody.slice(0, 200)}` }],
        activeProvider: 'none',
      })
    }

    return NextResponse.json({
      providers: [{ name: 'Gemini', model: GEMINI_MODEL, status: 'ok' as const, responseTime }],
      activeProvider: 'Gemini',
    })
  } catch (err: any) {
    return NextResponse.json({
      providers: [{ name: 'Gemini', model: GEMINI_MODEL, status: 'error' as const, responseTime: Date.now() - start, error: err?.message || 'Connection failed' }],
      activeProvider: 'none',
    })
  }
}
