import { NextResponse } from 'next/server'

interface ProviderTest {
  name: string
  model: string
  status: 'ok' | 'error' | 'not_configured'
  responseTime?: number
  error?: string
}

const GROQ_MODELS = [
  'llama-4-scout-17b-16e-instruct',
  'llama-4-maverick-17b-128e-instruct',
  'llama3-8b-8192',
  'llama3-70b-8192',
  'gemma2-9b-it',
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
]

interface ProviderConfig {
  id: string
  name: string
  model: string
  envKey: string
  type: 'openai' | 'gemini'
  baseUrl?: string
}

const PROVIDERS: ProviderConfig[] = [
  { id: 'gemini',     name: 'Gemini',      model: 'gemini-3.6-flash',                       envKey: 'GEMINI_API_KEY',       type: 'gemini' },
  { id: 'cerebras',   name: 'Cerebras',    model: 'llama3.1-8b',                            envKey: 'CEREBRAS_API_KEY',    type: 'openai', baseUrl: 'https://api.cerebras.ai/v1' },
  { id: 'together',   name: 'Together AI', model: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',  envKey: 'TOGETHER_API_KEY',    type: 'openai', baseUrl: 'https://api.together.xyz/v1' },
  { id: 'openrouter', name: 'OpenRouter',  model: 'meta-llama/llama-3.1-8b-instruct:free',  envKey: 'OPENROUTER_API_KEY',  type: 'openai', baseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'groq',       name: 'Groq',       model: 'auto (7 models)',                     envKey: 'GROQ_API_KEY',       type: 'openai', baseUrl: 'https://api.groq.com/openai/v1' },
]

async function testGroq(p: ProviderConfig): Promise<ProviderTest> {
  const apiKey = process.env[p.envKey]
  if (!apiKey) return { name: p.name, model: p.model, status: 'not_configured' }

  const start = Date.now()
  const errors: string[] = []

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'say ok' }], max_tokens: 5 }),
      })
      if (res.ok) {
        return { name: p.name, model: `${model} (auto)`, status: 'ok', responseTime: Date.now() - start }
      }
      const errBody = await res.text()
      errors.push(`${model}: ${res.status}`)
    } catch {
      errors.push(`${model}: connection failed`)
    }
  }

  return { name: p.name, model: p.model, status: 'error', responseTime: Date.now() - start, error: errors.join('; ') }
}

async function testOpenAI(p: ProviderConfig): Promise<ProviderTest> {
  const apiKey = process.env[p.envKey]
  if (!apiKey) return { name: p.name, model: p.model, status: 'not_configured' }

  const start = Date.now()
  try {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: p.model, messages: [{ role: 'user', content: 'say ok' }], max_tokens: 5 }),
    })
    const responseTime = Date.now() - start
    if (!res.ok) {
      const errBody = await res.text()
      return { name: p.name, model: p.model, status: 'error', responseTime, error: `${res.status}: ${errBody.slice(0, 200)}` }
    }
    return { name: p.name, model: p.model, status: 'ok', responseTime }
  } catch (err: any) {
    return { name: p.name, model: p.model, status: 'error', responseTime: Date.now() - start, error: err?.message || 'Connection failed' }
  }
}

async function testGemini(p: ProviderConfig): Promise<ProviderTest> {
  const apiKey = process.env[p.envKey]
  if (!apiKey) return { name: p.name, model: p.model, status: 'not_configured' }

  const start = Date.now()
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${p.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'say ok' }] }], generationConfig: { maxOutputTokens: 5 } }),
      }
    )
    const responseTime = Date.now() - start
    if (!res.ok) {
      const errBody = await res.text()
      return { name: p.name, model: p.model, status: 'error', responseTime, error: `${res.status}: ${errBody.slice(0, 200)}` }
    }
    return { name: p.name, model: p.model, status: 'ok', responseTime }
  } catch (err: any) {
    return { name: p.name, model: p.model, status: 'error', responseTime: Date.now() - start, error: err?.message || 'Connection failed' }
  }
}

export async function GET() {
  const results = await Promise.all(
    PROVIDERS.map(async (p) => {
      if (p.id === 'groq') return testGroq(p)
      if (p.type === 'gemini') return testGemini(p)
      return testOpenAI(p)
    })
  )

  const activeProvider = results.find(r => r.status === 'ok')?.name || 'none'

  return NextResponse.json({ providers: results, activeProvider })
}
