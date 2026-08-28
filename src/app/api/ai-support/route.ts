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

  if (entry.count >= MAX_MESSAGES_PER_MINUTE) {
    return false
  }

  entry.count++
  return true
}

// --- Provider: Groq (works everywhere, free, fast) ---
async function callGroq(messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not set')
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: 512,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Groq API ${res.status}: ${errBody.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content

  if (!text) {
    throw new Error('Groq returned empty response')
  }

  return text
}

// --- Provider: Google Gemini REST API (fallback) ---
async function callGemini(userMessage: string, history: { role: string; content: string }[], systemPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set')
  }

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = []

  for (const msg of history) {
    if (msg.content === systemPrompt) continue
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })
  }

  contents.push({ role: 'user', parts: [{ text: userMessage }] })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
    throw new Error(`Gemini API ${res.status}: ${errBody.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('Gemini returned empty response')
  }

  return text
}

// --- Provider: z-ai-web-dev-sdk (local dev only) ---
async function callZAI(history: { role: string; content: string }[]): Promise<string> {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()

  const completion = await zai.chat.completions.create({
    messages: history as any,
    thinking: { type: 'disabled' },
  })

  return completion.choices?.[0]?.message?.content || 'দুঃখিত, উত্তর দিতে সমস্যা হচ্ছে।'
}

export async function GET() {
  const hasGroq = !!process.env.GROQ_API_KEY
  const hasGemini = !!process.env.GEMINI_API_KEY

  return NextResponse.json({
    status: 'ok',
    provider: hasGroq ? 'groq' : hasGemini ? 'gemini' : 'z-ai-web-dev-sdk (local only)',
    groqKey: hasGroq ? `${process.env.GROQ_API_KEY!.slice(0, 8)}...` : 'not set',
    geminiKey: hasGemini ? `${process.env.GEMINI_API_KEY!.slice(0, 6)}...` : 'not set',
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
      return NextResponse.json(
        { error: 'একটু পর আবার চেষ্টা করুন' },
        { status: 429 }
      )
    }

    // Resolve system prompt (from DB or default)
    const systemPrompt = await getSystemPrompt()

    // Get or create conversation history
    let history = conversations.get(sessionId)
    if (!history) {
      history = [{ role: 'system', content: systemPrompt }]
      conversations.set(sessionId, history)
    }

    // Trim old messages (keep system + last 10 turns)
    if (history.length > 22) {
      history = [history[0], ...history.slice(-20)]
      conversations.set(sessionId, history)
    }

    let aiResponse: string

    // Provider priority: Groq > Gemini > z-ai (local), with fallback
    try {
      if (process.env.GROQ_API_KEY) {
        history.push({ role: 'user', content: message })
        try {
          aiResponse = await callGroq(history)
        } catch (groqErr: any) {
          console.error('[ai-support] Groq failed:', groqErr?.message)
          // Remove the pushed user message if Groq failed
          history.pop()
          if (process.env.GEMINI_API_KEY) {
            console.log('[ai-support] Falling back to Gemini')
            aiResponse = await callGemini(message, history, systemPrompt)
          } else {
            throw groqErr
          }
        }
      } else if (process.env.GEMINI_API_KEY) {
        aiResponse = await callGemini(message, history, systemPrompt)
      } else {
        history.push({ role: 'user', content: message })
        aiResponse = await callZAI(history)
      }
    } catch (err: any) {
      const msg = err?.message || ''
      console.error('[ai-support] All providers failed:', msg)
      return NextResponse.json(
        { error: `AI সার্ভার সমস্যা: ${msg.includes('API key') ? 'API Key সেট করা নেই' : msg.slice(0, 120)}` },
        { status: 500 }
      )
    }

    // Save to conversation history
    if (!process.env.GEMINI_API_KEY) {
      // For Groq and z-ai, user message was already pushed
    } else {
      history.push({ role: 'user', content: message })
    }
    history.push({ role: 'assistant', content: aiResponse })
    conversations.set(sessionId, history)

    return NextResponse.json({ response: aiResponse })
  } catch (err: any) {
    console.error('[ai-support] Unexpected error:', err?.message || err)
    return NextResponse.json(
      { error: 'সার্ভারে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    if (sessionId) {
      conversations.delete(sessionId)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}