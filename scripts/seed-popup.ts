import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const TURSO_URL = 'libsql://amardeal-asibhossain77.aws-ap-south-1.turso.io'
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE3ODUwMzc2MzMsImlhdCI6MTc4NDk1MTIzMywiaWQiOiIwMTlmNDc2Yi1jODAxLTc4MzctYWU1Zi1hMzkzNjhjOGY5OTAiLCJraWQiOiJPTU92OW1sMlJ2dEJPSlFrUDh3NFNUclQ0SDRPdTVSa0x0ZzBnbnlQcGJjIiwicmlkIjoiZTYwNjA2OWMtYTE0MS00MmYzLTlkNGEtMDdiZTJhZDEwNGM5In0.rBv99Bsy0DkDqi6DtoNXptXE1qMU8FX42toTj0ORfuTBr8dj2mSn0I5QGR_MYr80hXZS_KJMfTVsnRkkqGPSBA'

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
