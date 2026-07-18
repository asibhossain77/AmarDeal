import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// In-memory conversation store (per sessionId)
const conversations = new Map<string, { role: string; content: string }[]>()

const SYSTEM_PROMPT = `তুমি "আমারডিল" (AmarDeal) এর AI সাপোর্ট অ্যাসিস্ট্যান্ট। তোমার কাজ ইউজারদের প্রশ্নের সঠিক উত্তর দেওয়া।

গুরুত্বপূর্ণ নিয়ম:
- ইউজার যে ভাষায় কথা বলবে সেই ভাষায় উত্তর দাও (বাংলা, English, হিন্দি যাই হোক)
- সংক্ষেপে ও পরিষ্কারভাবে উত্তর দাও
- আমারডিল সম্পর্কে না জানলে সৎভাবে বলো
- কোনো সংবেদনশীল তথ্য (পাসওয়ার্ড, ব্যাংক ডিটেইলস) কখনো জিজ্ঞাস করো না
- ইউজার যেভাবেই কথা বলুক (আঞ্চলিক, আধুনিক, মিশ্র ভাষা) সেভাবেই বুঝে উত্তর দাও

আমারডিল সম্পর্কে তথ্য:
• আমারডিল বাংলাদেশের একটি এসক্রো (Escrow) প্ল্যাটফর্ম।
• এটি অনলাইনে নিরাপদ লেনদেন নিশ্চিত করে — ক্রেতা টাকা প্ল্যাটফর্মে জমা দেয়, পণ্য/সেবা পেলে বিক্রেতাকে টাকা দেওয়া হয়।
• ক্রেতা ও বিক্রেতা উভয়েই সুরক্ষিত।

কিভাবে কাজ করে:
1. ডিল তৈরি করুন (ক্রেতা বা বিক্রেতা যে কেউ করতে পারে)
2. ক্রেতা পেমেন্ট জমা দেয় আমারডিল প্ল্যাটফর্মে
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

// --- Provider: Google Gemini (works everywhere) ---
async function callGemini(userMessage: string, history: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
  })

  // Build conversation history for Gemini (skip the system prompt entry)
  const geminiHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []

  for (const msg of history) {
    if (msg.content === SYSTEM_PROMPT) continue // skip system prompt
    geminiHistory.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })
  }

  const chat = model.startChat({ history: geminiHistory })
  const result = await chat.sendMessage(userMessage)

  const text = result.response.text()
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

export async function GET(req: NextRequest) {
  // Health check / debug endpoint
  const hasKey = !!process.env.GEMINI_API_KEY
  const keyPreview = hasKey ? `${process.env.GEMINI_API_KEY!.slice(0, 6)}...${process.env.GEMINI_API_KEY!.slice(-4)}` : 'not set'

  return NextResponse.json({
    status: 'ok',
    provider: hasKey ? 'gemini' : 'z-ai-web-dev-sdk (local only)',
    geminiKey: keyPreview,
    note: hasKey ? 'Gemini API key is configured' : 'GEMINI_API_KEY not set — will use local SDK (Vercel will fail)',
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

    // Get or create conversation history
    let history = conversations.get(sessionId)
    if (!history) {
      history = [{ role: 'assistant', content: SYSTEM_PROMPT }]
      conversations.set(sessionId, history)
    }

    // Trim old messages (keep system + last 10 turns)
    if (history.length > 22) {
      history = [history[0], ...history.slice(-20)]
      conversations.set(sessionId, history)
    }

    let aiResponse: string

    // Choose provider: Gemini if API key is set, otherwise z-ai-web-dev-sdk
    if (process.env.GEMINI_API_KEY) {
      // For Gemini: pass userMessage separately, history without user message
      aiResponse = await callGemini(message, history)
    } else {
      // For z-ai: add user message to history first
      history.push({ role: 'user', content: message })
      aiResponse = await callZAI(history)
    }

    // Save to conversation history
    history.push({ role: 'user', content: message })
    history.push({ role: 'assistant', content: aiResponse })
    conversations.set(sessionId, history)

    return NextResponse.json({ response: aiResponse })
  } catch (err: any) {
    console.error('[ai-support] Error:', err?.message || err)

    // Return detailed error for debugging
    const isDev = process.env.NODE_ENV === 'development'
    return NextResponse.json(
      {
        error: isDev ? `ত্রুটি: ${err?.message || 'অজানা'}` : 'সার্ভারে সমস্যা হয়েছে',
        debug: isDev ? err?.message : undefined,
      },
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