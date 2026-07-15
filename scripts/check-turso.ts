import { createClient } from '@libsql/client'
import * as fs from 'fs'

// Read .env directly to avoid any shell env interference
const envContent = fs.readFileSync('/home/z/my-project/.env', 'utf-8')
const env: Record<string, string> = {}
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) env[key.trim()] = rest.join('=').trim()
})

console.log('URL from .env:', env.DATABASE_URL?.substring(0, 50) + '...')

const client = createClient({
  url: env.DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
})

async function check() {
  // Try with explicit primary read
  const tables = await client.execute({ sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" })
  console.log('Tables:', tables.rows.map(r => r.name).join(', '))
  console.log('Total tables:', tables.rows.length)

  if (tables.rows.length === 0) {
    console.log('\n⚠️ No tables found! Creating...')
    await client.execute(`CREATE TABLE IF NOT EXISTS test_table (id TEXT PRIMARY KEY)`)
    await client.execute(`INSERT INTO test_table VALUES ('hello')`)
    const test = await client.execute(`SELECT * FROM test_table`)
    console.log('Test table:', test.rows)
    await client.execute(`DROP TABLE test_table`)
    console.log('Write works, but read might hit replica. Tables might exist on primary.')
  } else {
    const users = await client.execute("SELECT id, name, phone, email FROM User")
    console.log(`\nUsers (${users.rows.length}):`)
    users.rows.forEach(u => console.log(`  - ${u.name} | ${u.phone} | ${u.email}`))
  }

  await client.close()
}
check().catch(console.error)