import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const TURSO_URL = 'libsql://amardeal-asibhossain77.aws-ap-south-1.turso.io'
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE3ODUxMjQwNTYsImlhdCI6MTc4NTAzNzY1NywiaWQiOiIwMTlmNDc2Yi1jODAxLTc4MzctYWU1Zi1hMzkzNjhjOGY5OTAiLCJraWQiOiJPTU92OW1sMlJ2dEJPSlFrUDh3NFNUclQ0SDRPdTVSa0x0ZzBnbnlQcGJjIiwicmlkIjoiZTYwNjA2OWMtYTE0MS00MmYzLTlkNGEtMDdiZTJhZDEwNGM5In0.HgBbN5fSGDjNTxewUdMjYK4kb0s_XH5k18NcEboX8qMnXG2zvStNKK8r8S28lVY3Q9jS5b2EjyLTCMesUkQSCA'

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

  console.log('✅ Turso seeded: EN=Midman, BN=মিডম্যান')
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
