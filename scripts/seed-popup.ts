import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'
import * as fs from 'fs'

// Production creds are read from env — NEVER hardcode tokens in git.
// (The previously hardcoded tokens leaked into the repo and have since
// expired; they are intentionally not replaced here.)
// Resolution order: shell env → /home/z/my-project/.env → amardeal/.env
const env: Record<string, string> = {}
for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v
for (const envPath of ['/home/z/my-project/.env', '/home/z/my-project/amardeal/.env']) {
  try {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const [key, ...rest] = line.split('=')
      if (key && rest.length && env[key.trim()] === undefined) env[key.trim()] = rest.join('=').trim()
    }
  } catch { /* optional file */ }
}

const TURSO_URL = env.TURSO_DATABASE_URL || ''
const TURSO_TOKEN = env.TURSO_AUTH_TOKEN || ''
if (!TURSO_URL.startsWith('libsql://') || !TURSO_TOKEN) {
  console.error('❌ Missing production creds: set TURSO_DATABASE_URL (libsql://...) and TURSO_AUTH_TOKEN in /home/z/my-project/.env')
  process.exit(1)
}

async function main() {
  const libsql = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })
  const adapter = new PrismaLibSQL(libsql)
  const db = new PrismaClient({ adapter })

  const config = JSON.stringify({
    enabled: true,
    content: '<div style="text-align:center">🎉 <b>আমারডিলে</b> স্বাগতম!</div><br/><br/>আমরা এখন <span style="color:var(--primary);font-weight:700;font-size:16px">১০০% ফ্রি</span> পেমেন্ট প্রসেসিং অফার করছি! 🚀<br/><br/>যেকোনো ডিল তৈরি করুন এবং <span style="color:var(--primary);font-weight:600">কোনো ফি</span> ছাড়াই নিরাপদে লেনদেন সম্পন্ন করুন।',
    image: '',
    link: '/login',
    buttonTitle: 'এখনই শুরু করুন'
  })

  await db.platformSetting.upsert({
    where: { key: 'popup_config' },
    update: { value: config, updatedAt: new Date() },
    create: { key: 'popup_config', value: config },
  })

  console.log('✅ Demo popup inserted!')
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
