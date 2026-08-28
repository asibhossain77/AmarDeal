import { NextResponse } from 'next/server'

interface ProviderTest {
  name: string
  model: string
  status: 'ok' | 'error' | 'not_configured'
  responseTime?: number
  error?: string
}

async function testGroq(): Promise<ProviderTest> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { name: 'Groq', model: 'llama-3.1-8b-instant', status: 'not_configured' }
  }

  const start = Date.now()
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: 'say ok' }],
      max_tokens: 5,
      }),
    })

    const responseTime = Date.now() - start

    if (!res.ok) {
      const errBody = await res.text()
      return {
        name: 'Groq',
        model: 'llama-3.1-8b-instant',
        status: 'error',
        responseTime,
        error: `${res.status}: ${errBody.slice(0, 200)}`,
      }
    }

    return {
      name: 'Groq',
      model: 'llama-3.1-8b-instant',
      status: 'ok',
      responseTime,
    }
  } catch (err: any) {
    return {
      name: 'Groq',
      model: 'llama-3.1-8b-instant',
      status: 'error',
      responseTime: Date.now() - start,
      error: err?.message || 'Connection failed',
    }
  }
}

async function testGemini(): Promise<ProviderTest> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { name: 'Gemini', model: 'gemini-3.6-flash', status: 'not_configured' }
  }

  const start = Date.now()
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'say ok' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      }
    )

    const responseTime = Date.now() - start

    if (!res.ok) {
      const errBody = await res.text()
      return {
        name: 'Gemini',
        model: 'gemini-3.6-flash',
        status: 'error',
        responseTime,
        error: `${res.status}: ${errBody.slice(0, 200)}`,
      }
    }

    return {
      name: 'Gemini',
      model: 'gemini-3.6-flash',
      status: 'ok',
      responseTime,
    }
  } catch (err: any) {
    return {
      name: 'Gemini',
      model: 'gemini-3.6-flash',
      status: 'error',
      responseTime: Date.now() - start,
      error: err?.message || 'Connection failed',
    }
  }
}

export async function GET() {
  const [groq, gemini] = await Promise.all([testGroq(), testGemini()])

  const activeProvider = groq.status === 'ok' ? 'groq'
    : gemini.status === 'ok' ? 'gemini'
    : 'none'

  return NextResponse.json({ groq, gemini, activeProvider })
}
