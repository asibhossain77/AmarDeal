# Task 2: PipraPay Backend API Routes

## Agent: piprapay-backend

## Files Created

1. `src/app/api/payment/piprapay/create-charge/route.ts` - POST endpoint
   - Requires auth via `requireAuth(req)` from `@/lib/deal-guard`
   - Accepts `{ dealId }` in body
   - Validates deal exists, status is `created`, user is buyer
   - Loads PipraPay settings from PlatformSetting (api_key, base_url, enabled)
   - Returns 403 if not enabled
   - Calls PipraPay Create Charge API with proper headers and body
   - Updates deal: status to payment_pending, transactionId to invoice_id, paymentAmount to deal.amount
   - Returns redirect_url and invoice_id

2. `src/app/api/payment/piprapay/success/route.ts` - GET endpoint
   - Gets pp_id from query params
   - Redirects to /?piprapay=success&pp_id={pp_id}

3. `src/app/api/payment/piprapay/cancel/route.ts` - GET endpoint
   - Redirects to /?piprapay=cancel

4. `src/app/api/payment/piprapay/webhook/route.ts` - POST endpoint (public, no auth)
   - Parses JSON body, extracts pp_id
   - Verifies payment by calling PipraPay Verify API
   - Finds deal by metadata.deal_id or fallback by transactionId
   - Updates deal status to payment_verified

5. `src/app/api/payment/piprapay/verify/route.ts` - POST endpoint (auth required)
   - Requires auth, accepts { pp_id }
   - Calls PipraPay Verify API
   - Finds deal by transactionId matching pp_id
   - Updates deal status to payment_verified
   - Returns { success: true, status: deal.status }

## Patterns Used
- Lazy DB import: `const { db } = await import('@/lib/db')`
- Auth guard: `requireAuth(req)` from `@/lib/deal-guard`
- PlatformSetting CRUD pattern from google-oauth route
- Bengali error messages consistent with existing codebase
- [PIPRAPAY] prefixed console logging
- try/catch error handling everywhere

## Lint Status
- No new lint errors introduced (all 9 errors/warnings are pre-existing)
