import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const TURSO_URL = 'libsql://amardeal-asibhossain77.aws-ap-south-1.turso.io'
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE3ODUwMzc2MzMsImlhdCI6MTc4NDk1MTIzMywiaWQiOiIwMTlmNDc2Yi1jODAxLTc4MzctYWU1Zi1hMzkzNjhjOGY5OTAiLCJraWQiOiJPTU92OW1sMlJ2dEJPSlFrUDh3NFNUclQ0SDRPdTVSa0x0ZzBnbnlQcGJjIiwicmlkIjoiZTYwNjA2OWMtYTE0MS00MmYzLTlkNGEtMDdiZTJhZDEwNGM5In0.rBv99Bsy0DkDqi6DtoNXptXE1qMU8FX42toTj0ORfuTBr8dj2mSn0I5QGR_MYr80hXZS_KJMfTVsnRkkqGPSBA'

async function main() {
  const libsql = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })
  const adapter = new PrismaLibSQL(libsql)
  const db = new PrismaClient({ adapter })

  await db.platformSetting.upsert({
    where: { key: 'platform_name' },
    update: { value: 'মিডম্যান', updatedAt: new Date() },
    create: { key: 'platform_name', value: 'মিডম্যান' },
  })

  await db.platformSetting.upsert({
    where: { key: 'platform_name_en' },
    update: { value: 'Midman', updatedAt: new Date() },
    create: { key: 'platform_name_en', value: 'Midman' },
  })

  console.log('✅ Website name seeded: EN=Midman, BN=মিডম্যান')
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
