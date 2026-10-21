/* Task 13 rebase E2E smoke test — two seller roles, post-rebase verification.
 * Runs against the local dev server (port 3000) + local SQLite DB.
 *
 * Covers:
 *  1. business application → pending (no self-verify)
 *  2. admin approve → User.sellerRole=business + businessVerified=true
 *  3. personal application → code verify → sellerRole=personal
 *  4. 403 gating: personal seller cannot edit business profile fields
 *  5. /api/products exposes sellerRole + businessVerified
 *  6. /api/health schema heal reports OK
 */
const BASE = 'http://localhost:3000'
const results: { name: string; ok: boolean; detail?: string }[] = []

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' | ' + detail : ''}`)
}

async function login(identifier: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  if (!res.ok) throw new Error(`login ${identifier} → ${res.status}: ${await res.text()}`)
  const setCookie = res.headers.get('set-cookie') || ''
  const m = setCookie.match(/midman_session=([^;]+)/)
  if (!m) throw new Error(`no session cookie for ${identifier}`)
  return m[1]
}

async function api(cookie: string, path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Cookie: `midman_session=${cookie}`, ...(init?.headers || {}) },
  })
  let body: unknown = null
  try { body = await res.json() } catch {}
  return { status: res.status, body } as { status: number; body: any }
}

async function main() {
  // 0. health
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json())
  check('health: schema heal OK', String(health.schemaHeal || '').startsWith('OK'), String(health.schemaHeal).slice(0, 80))

  // 1. business application → pending
  const u1 = await login('biz-e2e@midman.test', 'test1234')
  const biz = await api(u1, '/api/user/become-seller', {
    method: 'POST',
    body: JSON.stringify({
      applicationType: 'business',
      businessName: 'Rebase Test Shop',
      idType: 'nid',
      idNumber: '19987654321',
      whatsappNumber: '+8801711223344',
    }),
  })
  check('business apply accepted', biz.status === 200 && biz.body?.success === true, JSON.stringify(biz.body).slice(0, 120))

  // duplicate pending application blocked
  const bizDup = await api(u1, '/api/user/become-seller', {
    method: 'POST',
    body: JSON.stringify({ applicationType: 'personal', whatsappNumber: '+8801711223344' }),
  })
  check('duplicate pending blocked', bizDup.status === 400 && bizDup.body?.pending === true, JSON.stringify(bizDup.body).slice(0, 100))

  // business application cannot self-verify
  const verifyTry = await api(u1, '/api/user/become-seller/verify', {
    method: 'POST',
    body: JSON.stringify({ code: '000000' }),
  })
  check('business cannot self-verify', verifyTry.status === 400, JSON.stringify(verifyTry.body).slice(0, 100))

  // 2. admin approves
  const admin = await login('admin@demo.com', 'test1234')
  const apps = await api(admin, '/api/admin/seller-applications')
  const pendingApp = (apps.body?.applications || []).find(
    (a: any) => a.status === 'pending' && a.applicationType === 'business' && a.businessName === 'Rebase Test Shop'
  )
  check('admin sees business application', !!pendingApp, pendingApp ? `id=${pendingApp.id}` : JSON.stringify(apps.body).slice(0, 150))
  check('admin sees idNumber + idType', !!pendingApp && pendingApp.idType === 'nid' && !!pendingApp.idNumber, pendingApp ? `${pendingApp.idType}/${pendingApp.idNumber}` : '')

  const approve = await api(admin, `/api/admin/seller-applications/${pendingApp.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved' }),
  })
  check('admin approves business', approve.status === 200, JSON.stringify(approve.body).slice(0, 100))

  const me1 = await api(u1, '/api/auth/me')
  check('user is now business seller', me1.body?.isSeller === true && me1.body?.sellerRole === 'business' && me1.body?.businessVerified === true, JSON.stringify({ isSeller: me1.body?.isSeller, sellerRole: me1.body?.sellerRole, bv: me1.body?.businessVerified }))

  // re-apply blocked for verified business
  const reapply = await api(u1, '/api/user/become-seller', {
    method: 'POST',
    body: JSON.stringify({ applicationType: 'business', businessName: 'Again', idType: 'nid', idNumber: '12345678', whatsappNumber: '+8801711223344' }),
  })
  check('verified business cannot re-apply', reapply.status === 400, JSON.stringify(reapply.body).slice(0, 100))

  // 3. personal flow: another user
  const u2 = await login('pers-e2e@midman.test', 'test1234')
  const personal = await api(u2, '/api/user/become-seller', {
    method: 'POST',
    body: JSON.stringify({ applicationType: 'personal', whatsappNumber: '+8801722334455' }),
  })
  check('personal apply accepted', personal.status === 200 && personal.body?.success === true, JSON.stringify(personal.body).slice(0, 100))

  const adminApps2 = await api(admin, '/api/admin/seller-applications')
  const pApp = (adminApps2.body?.applications || []).find(
    (a: any) => a.status === 'pending' && a.applicationType === 'personal' && a.whatsappNumber === '+8801722334455'
  )
  check('admin sees personal application with code', !!pApp && !!pApp.verificationCode, pApp ? 'code present' : 'missing')

  const verify = await api(u2, '/api/user/become-seller/verify', {
    method: 'POST',
    body: JSON.stringify({ code: pApp?.verificationCode }),
  })
  check('personal verify OK', verify.status === 200, JSON.stringify(verify.body).slice(0, 100))

  const me2 = await api(u2, '/api/auth/me')
  check('user is personal seller', me2.body?.isSeller === true && me2.body?.sellerRole === 'personal' && me2.body?.businessVerified === false, JSON.stringify({ role: me2.body?.sellerRole, bv: me2.body?.businessVerified }))

  // 4. gating: personal seller cannot edit business fields (403)
  const patchBiz = await api(u2, '/api/seller/profile', {
    method: 'PUT',
    body: JSON.stringify({ businessName: 'Sneaky Biz', businessBio: 'nope' }),
  })
  check('business profile edit gated (403)', patchBiz.status === 403, `status=${patchBiz.status}`)

  // name-only edit allowed for personal sellers
  const patchName = await api(u2, '/api/seller/profile', {
    method: 'PUT',
    body: JSON.stringify({ name: 'Personal Seller OK' }),
  })
  check('name edit allowed for personal', patchName.status === 200, `status=${patchName.status}`)

  // 5. products expose role fields
  const products = await fetch(`${BASE}/api/products`).then((r) => r.json())
  const first = (products.products || [])[0]
  check('products expose sellerRole/businessVerified', !!first && 'sellerRole' in first.seller && 'businessVerified' in first.seller, first ? `${first.seller.sellerRole}/${first.seller.businessVerified}` : 'no products')

  const detail = await fetch(`${BASE}/api/products/${first.id}`).then((r) => r.json())
  check('product detail exposes role fields', !!detail?.product?.seller && 'sellerRole' in detail.product.seller, detail?.product?.seller?.sellerRole)

  // 6. seller public profile exposes role
  const sellerId = first.seller.id
  const pub = await fetch(`${BASE}/api/seller/${sellerId}/public`).then((r) => r.json())
  check('public seller profile exposes role', 'sellerRole' in (pub.seller || pub), JSON.stringify(pub).slice(0, 80))

  console.log('\n==== SUMMARY ====')
  const failed = results.filter((r) => !r.ok)
  console.log(`${results.length - failed.length}/${results.length} passed`)
  if (failed.length) {
    console.log('FAILED:', failed.map((f) => f.name).join(' | '))
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('E2E crashed:', e)
  process.exit(1)
})
