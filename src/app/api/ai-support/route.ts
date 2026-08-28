import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// In-memory conversation store (per sessionId)
const conversations = new Map<string, { role: string; content: string }[]>()

const DEFAULT_SYSTEM_PROMPT = `তুমি "মিডম্যান" (Midman) এর AI সাপোর্ট। তোমার কাজ ইউজারদের প্রশ্নের সঠিক উত্তর দেওয়া।

গুরুত্বপূর্ণ নিয়ম:
- ইউজার যে ভাষায় কথা বলবে সেই ভাষায় উত্তর দাও (বাংলা, English, হিন্দি যাই হোক)
- সংক্ষেপে ও পরিষ্কারভাবে উত্তর দাও
- মিডম্যান সম্পর্কে না জানলে সৎভাবে বলো
- কোনো সংবেদনশীল তথ্য (পাসওয়ার্ড, ব্যাংক ডিটেইলস) কখনো জিজ্ঞাস করো না
- ইউজার যেভাবেই কথা বলুক (আঞ্চলিক, আধুনিক, মিশ্র ভাষা) সেভাবেই বুঝে উত্তর দাও

মিডম্যান সম্পর্কে তথ্য:
• মিডম্যান বাংলাদেশের একটি এসক্রো (Escrow) প্ল্যাটফর্ম।
• এটি অনলাইনে নিরাপদ লেনদেন নিশ্চিত করে — ক্রেতা টাকা প্ল্যাটফর্মে জমা দেয়, পণ্য/সেবা পেলে বিক্রেতাকে টাকা দেওয়া হয়।
• ক্রেতা ও বিক্রেতা উভয়েই সুরক্ষিত।

কিভাবে কাজ করে:
1. ডিল তৈরি করুন (ক্রেতা বা বিক্রেতা যে কেউ করতে পারে)
2. ক্রেতা পেমেন্ট জমা দেয় মিডম্যান প্ল্যাটফর্মে
3. বিক্রেতা পণ্য/সেবা সরবরাহ করে
4. ক্রেতা কনফার্ম করলে বিক্রেতাকে টাকা দেওয়া হয়
5. কোনো সমস্যা হলে অ্যাডমিন মধ্যস্থতা করে

ফি কাঠামো (প্ল্যাটফর্ম ফি):
• ৩০-১৯৯ টাকা → ১০ টাকা ফি
• ২০০-৫৯৯ টাকা → ২০ টাকা ফি
• ৬০০-৯৯৯ টাকা → ৩০ টাকা ফি
• ১,০০০-১,৯৯৯ টাকা → ৪০ টাকা ফি
• ২,০০০-৩,৯৯৯ টাকা → ৫০ টাকা ফি
• ৪,০০০-৯,৯৯৯ টাকা → ৮০ টাকা ফি
• ১০,০০০-১৯,৯৯৯ টাকা → ১৫০ টাকা ফি
• ২০,০০০-৪৯,৯৯৯ টাকা → ২৫০ টাকা ফি
• ৫০,০০০+ টাকা → ১,০০০ টাকা ফি

পেমেন্ট মেথড:
• বিকাশ, নগদ, রকেট, ক্যাশ অন ডেলিভারি
• ব্যাংক ট্রান্সফার

নিরাপত্তা:
• টাকা সরাসরি বিক্রেতার কাছে যায় না — এসক্রোতে থাকে
• বিতর্ক হলে অ্যাডমিন মধ্যস্থতা করে
• প্রতারণা হলে টাকা ফেরত দেওয়া হয়

অ্যাকাউন্ট:
• ফোন নম্বর বা ইমেইল দিয়ে রেজিস্ট্রেশন
• ইমেইল ভেরিফিকেশন প্রয়োজন
• বিক্রেতা হিসেবে কাজ করতে আলাদা অনুমতি লাগে

সাধারণ প্রশ্নের উত্তর:
• "ফি কত?" → ডিলের পরিমাণ অনুযায়ী ফি ভিন্ন। ৩০-১৯৯ টাকার ডিলে ১০ টাকা, ২০০-৫৯৯ টাকায় ২০ টাকা। বিস্তারিত ফি কাঠামো ওয়েবসাইটে দেখুন।
• "কিভাবে ডিল করবো?" → লগইন করুন → নতুন ডিল তৈরি করুন → ক্রেতা পেমেন্ট জমা দেবে → বিক্রেতা পণ্য দেবে → কনফার্ম করলে টাকা যাবে।
• "টাকা ফেরত পাবো?" → বিক্রেতা পণ্য না দিলে বা কোনো সমস্যা হলে অ্যাডমিন যাচাই করে টাকা ফেরত দেয়।
• "পেমেন্ট কিভাবে?" → বিকাশ, নগদ, রকেট, ব্যাংক ট্রান্সফার, ক্যাশ অন ডেলিভারি — যেকোনো মাধ্যমে পেমেন্ট করতে পারবেন।
`

// In-memory cache for DB prompt (5-minute TTL)
let cachedPrompt: string | null = null
let cachedPromptAt = 0
const PROMPT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/** Invalidate the cached prompt (call after admin saves a new one) */
export function invalidatePromptCache() {
  cachedPrompt = null
  cachedPromptAt = 0
}

async function getSystemPrompt(): Promise<string> {
  const now = Date.now()
  if (cachedPrompt !== null && now - cachedPromptAt < PROMPT_CACHE_TTL) {
    return cachedPrompt
  }
  try {
    const row = await db.platformSetting.findUnique({ where: { key: 'ai_support_prompt' } })
    cachedPrompt = row?.value || DEFAULT_SYSTEM_PROMPT
    cachedPromptAt = now
    return cachedPrompt
  } catch {
    return DEFAULT_SYSTEM_PROMPT
  }
}

// Rate limiting — max 10 messages per minute per session
const rateLimits = new Map<string, { count: number; resetAt: number }>()
const MAX_MESSAGES_PER_MINUTE = 10

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(sessionId)
  if (!entry || now > entry.resetAt) {
    rateLimits.set(sessionId, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= MAX_MESSAGES_PER_MINUTE) return false
  entry.count++
  return true
}

// ============================================================
// AI PROVIDERS — Each returns text or throws
// ============================================================

type Msg = { role: string; content: string }

/** Generic OpenAI-compatible chat completion caller */
async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Msg[],
  extraHeaders?: Record<string, string>,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: 512,
      temperature: 0.7,
    }),
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`${res.status}: ${errBody.slice(0, 200)}`)
  }
  const data = await res.json()
  return data?.choices?.[0]?.message?.content || ''
}

// --- Provider definitions ---
// Order matters: first available & working provider wins

interface ProviderDef {
  id: string
  name: string
  model: string
  envKey: string
  type: 'openai' | 'gemini' | 'local'
}

const PROVIDERS: ProviderDef[] = [
  { id: 'gemini',   name: 'Gemini',      model: 'gemini-3.6-flash',                       envKey: 'GEMINI_API_KEY',       type: 'gemini' },
  { id: 'cerebras', name: 'Cerebras',    model: 'llama-3.3-70b',                            envKey: 'CEREBRAS_API_KEY',    type: 'openai' },
  { id: 'together', name: 'Together AI', model: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',  envKey: 'TOGETHER_API_KEY',    type: 'openai' },
  { id: 'openrouter', name: 'OpenRouter', model: 'meta-llama/llama-3.1-8b-instruct:free', envKey: 'OPENROUTER_API_KEY',  type: 'openai' },
  { id: 'groq',     name: 'Groq',       model: 'auto (7 models)',                     envKey: 'GROQ_API_KEY',       type: 'openai' },
  { id: 'zai',      name: 'z-ai (local)', model: 'local',                                  envKey: '',                     type: 'local' },
]

const OPENAI_BASE_URLS: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  together: 'https://api.together.xyz/v1',
  openrouter: 'https://openrouter.ai/api/v1',
}

/** Groq tries multiple models automatically */
const GROQ_MODELS = [
  'llama-4-scout-17b-16e-instruct',
  'llama-4-maverick-17b-128e-instruct',
  'llama3-8b-8192',
  'llama3-70b-8192',
  'gemma2-9b-it',
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
]

// --- Per-provider callers ---

async function callProvider(
  provider: ProviderDef,
  messages: Msg[],
  userMessage: string,
  systemPrompt: string,
): Promise<string> {
  if (provider.type === 'local') {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({ messages: messages as any, thinking: { type: 'disabled' } })
    return completion.choices?.[0]?.message?.content || 'দুঃখিত, উত্তর দিতে সমস্যা হচ্ছে।'
  }

  if (provider.type === 'gemini') {
    const apiKey = process.env[provider.envKey]
    if (!apiKey) throw new Error(`${provider.envKey} not set`)
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = []
    for (const msg of messages) {
      if (msg.role === 'system') continue
      contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] })
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
        }),
      }
    )
    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`${res.status}: ${errBody.slice(0, 200)}`)
    }
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  // OpenAI-compatible
  const apiKey = process.env[provider.envKey]
  if (!apiKey) throw new Error(`${provider.envKey} not set`)
  const baseUrl = OPENAI_BASE_URLS[provider.id]

  // Groq: try multiple models automatically
  if (provider.id === 'groq') {
    const errors: string[] = []
    for (const model of GROQ_MODELS) {
      try {
        console.log(`[ai-support] Groq trying model: ${model}`)
        const result = await callOpenAICompatible(baseUrl, apiKey, model, messages)
        if (result) {
          console.log(`[ai-support] Groq success with: ${model}`)
          return result
        }
      } catch (err: any) {
        console.log(`[ai-support] Groq ${model} failed:`, err?.message?.slice(0, 80))
        errors.push(`${model}: ${err?.message?.slice(0, 60) || 'unknown'}`)
      }
    }
    throw new Error(`All Groq models failed: ${errors.join('; ')}`)
  }

  return callOpenAICompatible(baseUrl, apiKey, provider.model, messages)
}

/** Get list of configured providers (have API keys set) */
export function getConfiguredProviders(): ProviderDef[] {
  return PROVIDERS.filter(p => {
    if (p.type === 'local') return true // always available in dev
    return !!process.env[p.envKey]
  })
}

export async function GET() {
  const configured = getConfiguredProviders()
  return NextResponse.json({
    status: 'ok',
    configured: configured.map(p => ({ id: p.id, name: p.name, model: p.model })),
    activeProvider: configured[0]?.id || 'none',
  })
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json()
    if (!message || !sessionId) {
      return NextResponse.json({ error: 'প্রশ্ন দিন' }, { status: 400 })
    }
    if (message.length > 500) {
      return NextResponse.json({ error: 'প্রশ্ন খুব বড়' }, { status: 400 })
    }
    if (!checkRateLimit(sessionId)) {
      return NextResponse.json({ error: 'একটু পর আবার চেষ্টা করুন' }, { status: 429 })
    }

    const systemPrompt = await getSystemPrompt()

    let history = conversations.get(sessionId)
    if (!history) {
      history = [{ role: 'system', content: systemPrompt }]
      conversations.set(sessionId, history)
    }
    if (history.length > 22) {
      history = [history[0], ...history.slice(-20)]
      conversations.set(sessionId, history)
    }

    const configured = getConfiguredProviders()
    let aiResponse: string | null = null
    let usedProvider: string | null = null
    let lastError = ''

    for (const provider of configured) {
      try {
        console.log(`[ai-support] Trying ${provider.name} (${provider.model})...`)

        if (provider.type === 'gemini') {
          aiResponse = await callProvider(provider, history, message, systemPrompt)
        } else {
          history.push({ role: 'user', content: message })
          aiResponse = await callProvider(provider, history, message, systemPrompt)
          if (!aiResponse) {
            history.pop()
            throw new Error('Empty response')
          }
        }

        usedProvider = provider.id
        console.log(`[ai-support] Success with ${provider.name}`)
        break
      } catch (err: any) {
        lastError = err?.message || 'Unknown error'
        console.error(`[ai-support] ${provider.name} failed:`, lastError)
        // Remove user message if we pushed it (non-gemini)
        if (provider.type !== 'gemini' && history[history.length - 1]?.content === message) {
          history.pop()
        }
        continue
      }
    }

    if (!aiResponse) {
      return NextResponse.json(
        { error: `AI সার্ভার সমস্যা: সব provider ফেইল হয়েছে। ${lastError.slice(0, 100)}` },
        { status: 500 }
      )
    }

    // Save to conversation history
    if (usedProvider !== 'gemini') {
      // user message already pushed above
    } else {
      history.push({ role: 'user', content: message })
    }
    history.push({ role: 'assistant', content: aiResponse })
    conversations.set(sessionId, history)

    return NextResponse.json({ response: aiResponse, provider: usedProvider })
  } catch (err: any) {
    console.error('[ai-support] Unexpected error:', err?.message || err)
    return NextResponse.json({ error: 'সার্ভারে সমস্যা হয়েছে' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    if (sessionId) conversations.delete(sessionId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
