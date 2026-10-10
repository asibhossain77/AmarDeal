#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Marketplace Direct Order — end-to-end API test suite
# (admin-owned SMM store). Starts its own dev server + mock
# PipraPay gateway, runs all tests, then tears everything down.
#
# Usage: bash scripts/marketplace-direct-order-tests.sh
# ═══════════════════════════════════════════════════════════════
set -u

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
PORT=3210
BASE="http://127.0.0.1:$PORT"
MOCK_PORT=4599
MOCK_BASE="http://127.0.0.1:$MOCK_PORT"
DB="db/custom.db"
LOGDIR=/tmp/mp-tests
mkdir -p "$LOGDIR"

PASS=0; FAIL=0; FAILED_NAMES=()

# Known local seed users (db/custom.db)
ADMIN_ID="cmrar4fgy0000vcitwu695oe7"   # admin@demo.com (super_admin)
USER1_ID="cmrasv1z80000vcfxrq4euu3w"   # user@demo.com
USER2_ID="cmte8cqrr000039uv95i9umiz"   # seller@demo.com

say()  { printf '%s\n' "$*"; }
pass() { PASS=$((PASS+1)); say "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); FAILED_NAMES+=("$1"); say "  ✗ $1  $2"; }

# assert_eq <name> <expected> <actual>
assert_eq() {
  if [ "$2" == "$3" ]; then pass "$1"; else fail "$1" "(expected=$2 actual=$3)"; fi
}
# assert_contains <name> <needle> <haystack>
assert_contains() {
  if echo "$3" | rg -q -- "$2"; then pass "$1"; else fail "$1" "(missing '$2' in: $(echo "$3" | head -c 160))"; fi
}

http_code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
http_body() { curl -s --max-time 30 "$@"; }

jqval() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1" 2>/dev/null; }

# ── DB helpers (direct sqlite via python) ──────────────────────
dbq() { python3 -c "
import sqlite3, sys
con = sqlite3.connect('$DB')
cur = con.cursor()
for row in cur.execute(sys.argv[1]):
    print(*row, sep='|')
" "$1" 2>/dev/null; }
dbx() { python3 -c "
import sqlite3, sys
con = sqlite3.connect('$DB')
cur = con.cursor()
cur.execute(sys.argv[1])
con.commit()
" "$1" 2>/dev/null; }

cleanup() {
  say ""
  say "── teardown ──"
  [ -n "${DEV_PID:-}" ] && kill "$DEV_PID" 2>/dev/null
  [ -n "${MOCK_PID:-}" ] && kill "$MOCK_PID" 2>/dev/null
  # Disable gateway config so the local app returns to its default state
  dbx "UPDATE PlatformSetting SET value='false' WHERE key='piprapay_enabled'"
  wait 2>/dev/null
}
trap cleanup EXIT

# ── 0. Prepare gateway config + mock ───────────────────────────
say "════════════════════════════════════════════════"
say " Marketplace Direct Order test suite"
say "════════════════════════════════════════════════"

for key in piprapay_api_key piprapay_base_url piprapay_enabled; do
  dbx "DELETE FROM PlatformSetting WHERE key='$key'"
done
dbx "INSERT INTO PlatformSetting (key, value, updatedAt) VALUES ('piprapay_api_key','test-api-key',CURRENT_TIMESTAMP)"
dbx "INSERT INTO PlatformSetting (key, value, updatedAt) VALUES ('piprapay_base_url','$MOCK_BASE',CURRENT_TIMESTAMP)"
dbx "INSERT INTO PlatformSetting (key, value, updatedAt) VALUES ('piprapay_enabled','true',CURRENT_TIMESTAMP)"

# Ensure a manual PaymentMethod exists
if [ -z "$(dbq "SELECT id FROM PaymentMethod LIMIT 1")" ]; then
  dbx "INSERT INTO PaymentMethod (id, name, accountNumber, accountType, status, sortOrder, color, createdAt, updatedAt) VALUES ('pm-test-1','bKash Test','01700000000','personal','active',0,'#E2136E',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
fi
PM_ID="$(dbq "SELECT id FROM PaymentMethod WHERE name='bKash Test' LIMIT 1")"
[ -z "$PM_ID" ] && PM_ID="$(dbq "SELECT id FROM PaymentMethod LIMIT 1")"

bun scripts/mock-piprapay.ts $MOCK_PORT > "$LOGDIR/mock.log" 2>&1 &
MOCK_PID=$!
sleep 1
assert_contains "mock gateway up" "listening" "$(cat "$LOGDIR/mock.log")"

# ── 1. Start dev server ────────────────────────────────────────
say ""
say "── starting dev server on :$PORT ──"
DATABASE_URL="file:$ROOT/db/custom.db" NEXT_PUBLIC_APP_URL="$BASE" bunx next dev -p $PORT > "$LOGDIR/dev.log" 2>&1 &
DEV_PID=$!
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null --max-time 5 -w '%{http_code}' "$BASE/api/health" || true)
  [ "$code" != "000" ] && break
  sleep 1
done
assert_eq "dev server responds" "200" "$code"

# ── 2. Admin service management ────────────────────────────────
say ""
say "── [T1] admin service management ──"
ADMIN_COOKIE="Cookie: midman_session=$ADMIN_ID"
USER1_COOKIE="Cookie: midman_session=$USER1_ID"
USER2_COOKIE="Cookie: midman_session=$USER2_ID"

body=$(http_body -X POST "$BASE/api/admin/marketplace/services" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"name":"Facebook Page Likes","category":"facebook","description":"High quality page likes","pricePerThousand":150,"minQuantity":100,"maxQuantity":100000,"linkTypes":["profile","page"],"deliveryEstimate":"0-6 hours","instructions":"Do not change page name while processing.","status":"published"}')
assert_contains "T1.1 admin creates service" '"success":true' "$body"
SVC_PUBLISHED=$(echo "$body" | jqval "d['service']['id']" | tr -d '\r')

body=$(http_body -X POST "$BASE/api/admin/marketplace/services" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"name":"Draft Service","category":"other","description":"draft only","pricePerThousand":100,"minQuantity":50,"maxQuantity":5000,"status":"draft"}')
assert_contains "T1.2 admin creates draft service" '"success":true' "$body"
SVC_DRAFT=$(echo "$body" | jqval "d['service']['id']" | tr -d '\r')

body=$(http_body -X POST "$BASE/api/admin/marketplace/services" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"name":"Paused Service","category":"other","description":"published but disabled","pricePerThousand":100,"minQuantity":50,"maxQuantity":5000,"status":"published","isActive":false}')
assert_contains "T1.3 admin creates paused service" '"success":true' "$body"
SVC_PAUSED=$(echo "$body" | jqval "d['service']['id']" | tr -d '\r')

body=$(http_body -X PATCH "$BASE/api/admin/marketplace/services/$SVC_PUBLISHED" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"pricePerThousand":175,"description":"High quality page likes — updated"}')
assert_contains "T1.4 admin edits service price/description" '"pricePerThousand":175' "$body"

body=$(http_body -X PATCH "$BASE/api/admin/marketplace/services/$SVC_PUBLISHED" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"status":"draft"}')
assert_contains "T1.5 admin unpublishes service" '"status":"draft"' "$body"
code=$(http_code "$BASE/api/marketplace/services/$SVC_PUBLISHED")
assert_eq "T1.6 unpublished service hidden from catalog" "404" "$code"

body=$(http_body -X PATCH "$BASE/api/admin/marketplace/services/$SVC_PUBLISHED" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"status":"published"}')
assert_contains "T1.7 admin re-publishes" '"status":"published"' "$body"

body=$(http_body -X PATCH "$BASE/api/admin/marketplace/services/$SVC_PUBLISHED" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"isActive":false}')
assert_contains "T1.8 admin disables service" '"isActive":false' "$body"
code=$(http_code "$BASE/api/marketplace/services/$SVC_PUBLISHED")
assert_eq "T1.9 disabled service hidden from catalog" "404" "$code"
body=$(http_body -X PATCH "$BASE/api/admin/marketplace/services/$SVC_PUBLISHED" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"isActive":true}')
assert_contains "T1.10 admin re-enables service" '"isActive":true' "$body"

body=$(http_body -X PATCH "$BASE/api/admin/marketplace/services/$SVC_PUBLISHED" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"minQuantity":200,"maxQuantity":50}')
assert_contains "T1.11 min>max rejected" 'Maximum quantity' "$body"

# ── 3. Seller restriction enforcement ──────────────────────────
say ""
say "── [T2] seller restrictions (server-enforced) ──"
code=$(http_code -X POST "$BASE/api/admin/marketplace/services" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d '{"name":"Hacker Service","description":"x","pricePerThousand":1,"minQuantity":1,"maxQuantity":10}')
assert_eq "T2.1 user cannot create service (403)" "403" "$code"

code=$(http_code -X POST "$BASE/api/admin/marketplace/services" -H "$USER2_COOKIE" -H 'Content-Type: application/json' -d '{"name":"Seller Service","description":"x","pricePerThousand":1,"minQuantity":1,"maxQuantity":10}')
assert_eq "T2.2 seller cannot create service (403)" "403" "$code"

code=$(http_code -X POST "$BASE/api/admin/marketplace/services" -H 'Content-Type: application/json' -d '{"name":"Anon Service","description":"x","pricePerThousand":1,"minQuantity":1,"maxQuantity":10}')
assert_eq "T2.3 anonymous cannot create service (401)" "401" "$code"

code=$(http_code -X PATCH "$BASE/api/admin/marketplace/services/$SVC_PUBLISHED" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d '{"pricePerThousand":1}')
assert_eq "T2.4 user cannot edit price (403)" "403" "$code"

code=$(http_code -X PATCH "$BASE/api/admin/marketplace/services/$SVC_PUBLISHED" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d '{"status":"published","isActive":true}')
assert_eq "T2.5 user cannot change status (403)" "403" "$code"

code=$(http_code -X DELETE "$BASE/api/admin/marketplace/services/$SVC_PUBLISHED" -H "$USER1_COOKIE")
assert_eq "T2.6 user cannot delete service (403)" "403" "$code"

# public catalog must not leak internal fields (provider system removed)
body=$(http_body "$BASE/api/marketplace/services")
assert_contains "T2.7 catalog lists published services" "Facebook Page Likes" "$body"
if echo "$body" | rg -q 'providerServiceId|providerName|providerOrderId'; then fail "T2.8 no internal fields leaked" "leaked"; else pass "T2.8 no internal fields leaked"; fi

# ── 4. Order validation & server-side pricing ──────────────────
say ""
say "── [T3] order validation + server-side pricing ──"
place_order() { # place_order <cookie> <serviceId> <qty> <link> <idempotencyKey> <extra-json>
  http_body -X POST "$BASE/api/marketplace/orders" -H "$1" -H 'Content-Type: application/json' \
    -d "{\"serviceId\":\"$2\",\"quantity\":$3,\"link\":\"$4\",\"linkType\":\"profile\",\"idempotencyKey\":\"$5\"$6}"
}
IK1="idk-test-$(date +%s)-a"

body=$(place_order "$USER1_COOKIE" "$SVC_PUBLISHED" 2000 "https://facebook.com/midman" "$IK1" ',"price":1,"totalAmount":1')
assert_contains "T3.1 order created" '"success":true' "$body"
ORDER1=$(echo "$body" | jqval "d['order']['id']" | tr -d '\r')
TOTAL=$(echo "$body" | jqval "d['order']['totalAmount']")
assert_eq "T3.2 server-side pricing 2000×175/1000=350 (client price ignored)" "350" "$TOTAL"

body=$(place_order "$USER1_COOKIE" "$SVC_PUBLISHED" 1234 "https://facebook.com/midman" "idk-frac-$RANDOM" "")
TOTALF=$(echo "$body" | jqval "d['order']['totalAmount']")
assert_eq "T3.3 fractional pricing 1234×175/1000=215.95 (poisha rounding)" "215.95" "$TOTALF"
ORDER_FRAC=$(echo "$body" | jqval "d['order']['id']" | tr -d '\r')

# USER2's own order (used for ownership-scoping tests)
body=$(place_order "$USER2_COOKIE" "$SVC_PUBLISHED" 300 "https://facebook.com/z" "idk-u2-$RANDOM" "")
ORDER_U2=$(echo "$body" | jqval "d['order']['id']" | tr -d '\r')
assert_contains "T3.3b user2 order created (for IDOR tests)" '"success":true' "$body"

body=$(place_order "$USER1_COOKIE" "$SVC_PUBLISHED" 2000 "https://facebook.com/midman" "$IK1" "")
assert_contains "T3.4 idempotent retry returns same order" "$ORDER1" "$body"

body=$(place_order "$USER2_COOKIE" "$SVC_PUBLISHED" 2000 "https://facebook.com/x" "$IK1" "")
assert_contains "T3.5 idempotency key owner mismatch rejected" 'Invalid request' "$body"

code=$(http_code -X POST "$BASE/api/marketplace/orders" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"serviceId\":\"$SVC_DRAFT\",\"quantity\":100,\"link\":\"https://x.com/a\",\"idempotencyKey\":\"idk-draft-$RANDOM\"}")
assert_eq "T3.6 draft service cannot be ordered (404)" "404" "$code"

code=$(http_code -X POST "$BASE/api/marketplace/orders" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"serviceId\":\"$SVC_PAUSED\",\"quantity\":100,\"link\":\"https://x.com/a\",\"idempotencyKey\":\"idk-paused-$RANDOM\"}")
assert_eq "T3.7 paused service cannot be ordered (404)" "404" "$code"

code=$(http_code -X POST "$BASE/api/marketplace/orders" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"serviceId\":\"$SVC_PUBLISHED\",\"quantity\":100,\"link\":\"not-a-url\",\"idempotencyKey\":\"idk-badlink-$RANDOM\"}")
assert_eq "T3.8 invalid link rejected (400)" "400" "$code"

code=$(http_code -X POST "$BASE/api/marketplace/orders" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"serviceId\":\"$SVC_PUBLISHED\",\"quantity\":100,\"link\":\"javascript:alert(1)\",\"idempotencyKey\":\"idk-js-$RANDOM\"}")
assert_eq "T3.9 javascript: link rejected (400)" "400" "$code"

code=$(http_code -X POST "$BASE/api/marketplace/orders" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"serviceId\":\"$SVC_PUBLISHED\",\"quantity\":0,\"link\":\"https://x.com/a\",\"idempotencyKey\":\"idk-q0-$RANDOM\"}")
assert_eq "T3.10 zero quantity rejected" "400" "$code"

code=$(http_code -X POST "$BASE/api/marketplace/orders" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"serviceId\":\"$SVC_PUBLISHED\",\"quantity\":-5,\"link\":\"https://x.com/a\",\"idempotencyKey\":\"idk-qn-$RANDOM\"}")
assert_eq "T3.11 negative quantity rejected" "400" "$code"

code=$(http_code -X POST "$BASE/api/marketplace/orders" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"serviceId\":\"$SVC_PUBLISHED\",\"quantity\":99.5,\"link\":\"https://x.com/a\",\"idempotencyKey\":\"idk-qf-$RANDOM\"}")
assert_eq "T3.12 fractional quantity rejected" "400" "$code"

code=$(http_code -X POST "$BASE/api/marketplace/orders" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"serviceId\":\"$SVC_PUBLISHED\",\"quantity\":50,\"link\":\"https://x.com/a\",\"idempotencyKey\":\"idk-below-$RANDOM\"}")
assert_eq "T3.13 below min quantity rejected" "400" "$code"

code=$(http_code -X POST "$BASE/api/marketplace/orders" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"serviceId\":\"$SVC_PUBLISHED\",\"quantity\":200000,\"link\":\"https://x.com/a\",\"idempotencyKey\":\"idk-above-$RANDOM\"}")
assert_eq "T3.14 above max quantity rejected" "400" "$code"

code=$(http_code -X POST "$BASE/api/marketplace/orders" -H 'Content-Type: application/json' -d "{\"serviceId\":\"$SVC_PUBLISHED\",\"quantity\":100,\"link\":\"https://x.com/a\",\"idempotencyKey\":\"idk-anon-$RANDOM\"}")
assert_eq "T3.15 anonymous order rejected (401)" "401" "$code"

body=$(http_body -X POST "$BASE/api/marketplace/orders" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"serviceId\":\"$SVC_PUBLISHED\",\"quantity\":100,\"link\":\"https://x.com/a\",\"linkType\":\"video\",\"idempotencyKey\":\"idk-lt-$RANDOM\"}")
assert_contains "T3.16 unsupported linkType rejected" 'লিংক টাইপ' "$body"

# ── 5. Order access control (IDOR) ─────────────────────────────
say ""
say "── [T4] order access control ──"
code=$(http_code "$BASE/api/marketplace/orders/$ORDER1" -H "$USER2_COOKIE")
assert_eq "T4.1 other user's order denied (403)" "403" "$code"
code=$(http_code "$BASE/api/marketplace/orders/$ORDER1")
assert_eq "T4.2 anonymous order access denied (401)" "401" "$code"
body=$(http_body "$BASE/api/marketplace/orders" -H "$USER1_COOKIE")
assert_contains "T4.3 own orders listed" "$ORDER1" "$body"
if echo "$body" | rg -q "$ORDER_U2"; then fail "T4.4 list scoped to owner" "leaked user2 order"; else pass "T4.4 list scoped to owner"; fi
body=$(http_body "$BASE/api/marketplace/orders/$ORDER1" -H "$USER1_COOKIE")
if echo "$body" | rg -q 'providerOrderId'; then fail "T4.5 providerOrderId hidden from customer" "leaked"; else pass "T4.5 providerOrderId hidden from customer"; fi
body=$(http_body "$BASE/api/marketplace/orders/$ORDER1" -H "$ADMIN_COOKIE")
assert_contains "T4.6 admin can view any order" '"isAdmin":true' "$body"

# ── 6. Payment: unverified never paid + idempotent callbacks ───
say ""
say "── [T5] payment verification & idempotency ──"
# 5.1 unverified payment (unknown pp_id)
body=$(http_body -X POST "$BASE/api/marketplace/payment/webhook" -H 'Content-Type: application/json' -d '{"pp_id":"TOTALLY-UNKNOWN"}')
assert_contains "T5.1 unknown pp_id webhook fails" '"success":false' "$body"
ST=$(dbq "SELECT status||'/'||paymentStatus FROM MarketplaceOrder WHERE id='$ORDER1'")
assert_eq "T5.2 order still pending/unpaid after failed webhook" "pending_payment/unpaid" "$ST"

# 5.2 amount mismatch never marks paid
curl -s -X POST "$MOCK_BASE/test/register" -H 'Content-Type: application/json' -d "{\"pp_id\":\"MISMATCH1\",\"amount\":\"1\",\"metadata\":{\"order_id\":\"$ORDER1\",\"mp\":\"1\"}}" > /dev/null
body=$(http_body -X POST "$BASE/api/marketplace/payment/webhook" -H 'Content-Type: application/json' -d '{"pp_id":"MISMATCH1"}')
assert_contains "T5.3 mismatch webhook rejected" 'amount_mismatch' "$body"
ST=$(dbq "SELECT status||'/'||paymentStatus FROM MarketplaceOrder WHERE id='$ORDER1'")
assert_eq "T5.4 order still unpaid after mismatch" "pending_payment/unpaid" "$ST"
EV=$(dbq "SELECT COUNT(*) FROM MarketplaceOrderEvent WHERE orderId='$ORDER1' AND type='payment_failed'")
assert_eq "T5.5 payment_failed event recorded" "1" "$EV"

# 5.3 gateway happy path: create-charge → webhook → paid+queued
body=$(http_body -X POST "$BASE/api/marketplace/payment/create-charge" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"orderId\":\"$ORDER1\"}")
assert_contains "T5.6 create-charge succeeds" 'redirect_url' "$body"
INVOICE=$(echo "$body" | jqval "d['invoice_id']" | tr -d '\r')
STORED_INV=$(dbq "SELECT piprapayInvoiceId FROM MarketplaceOrder WHERE id='$ORDER1'")
assert_eq "T5.7 invoice persisted before redirect" "$INVOICE" "$STORED_INV"

# other user cannot pay someone else's order
code=$(http_code -X POST "$BASE/api/marketplace/payment/create-charge" -H "$USER2_COOKIE" -H 'Content-Type: application/json' -d "{\"orderId\":\"$ORDER1\"}")
assert_eq "T5.8 create-charge owner-only (403)" "403" "$code"

# webhook once
body=$(http_body -X POST "$BASE/api/marketplace/payment/webhook" -H 'Content-Type: application/json' -d "{\"pp_id\":\"$INVOICE\"}")
assert_contains "T5.9 webhook confirms payment" '"success":true' "$body"
ST=$(dbq "SELECT status||'/'||paymentStatus FROM MarketplaceOrder WHERE id='$ORDER1'")
assert_eq "T5.10 order paid + queued" "queued/paid" "$ST"

# webhook twice (duplicate callback)
body=$(http_body -X POST "$BASE/api/marketplace/payment/webhook" -H 'Content-Type: application/json' -d "{\"pp_id\":\"$INVOICE\"}")
assert_contains "T5.11 duplicate webhook idempotent" 'alreadyPaid' "$body"
EV=$(dbq "SELECT COUNT(*) FROM MarketplaceOrderEvent WHERE orderId='$ORDER1' AND type='payment_verified'")
assert_eq "T5.12 exactly one payment_verified event" "1" "$EV"

# verify endpoint also idempotent for the same pp_id
body=$(http_body -X POST "$BASE/api/marketplace/payment/verify" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"pp_id\":\"$INVOICE\"}")
assert_contains "T5.13 customer verify idempotent" 'alreadyPaid' "$body"

# create-charge on a paid order
code=$(http_code -X POST "$BASE/api/marketplace/payment/create-charge" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"orderId\":\"$ORDER1\"}")
assert_eq "T5.14 create-charge blocked on paid order (409)" "409" "$code"

# ── 7. Manual payment flow + duplicate TXN protection ──────────
say ""
say "── [T6] manual payment + admin verification ──"
TXN1="TXN-MANUAL-$(date +%s)"
body=$(http_body -X POST "$BASE/api/marketplace/orders/$ORDER_FRAC/payment" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"paymentMethodId\":\"$PM_ID\",\"senderNumber\":\"01711111111\",\"transactionId\":\"$TXN1\"}")
assert_contains "T6.1 manual payment submitted" '"success":true' "$body"
ST=$(dbq "SELECT paymentStatus FROM MarketplaceOrder WHERE id='$ORDER_FRAC'")
assert_eq "T6.2 awaiting_verification (NOT paid)" "awaiting_verification" "$ST"

body=$(http_body -X POST "$BASE/api/marketplace/orders/$ORDER1/payment" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"paymentMethodId\":\"$PM_ID\",\"senderNumber\":\"01711111111\",\"transactionId\":\"$TXN1\"}")
assert_contains "T6.3 payment submission to paid order blocked" 'গ্রহণযোগ্য নয়' "$body"

# second order, same TXN
body=$(place_order "$USER1_COOKIE" "$SVC_PUBLISHED" 300 "https://facebook.com/q" "idk-txn2-$RANDOM" "")
ORDER3=$(echo "$body" | jqval "d['order']['id']" | tr -d '\r')
body=$(http_body -X POST "$BASE/api/marketplace/orders/$ORDER3/payment" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"paymentMethodId\":\"$PM_ID\",\"senderNumber\":\"01711111111\",\"transactionId\":\"$TXN1\"}")
assert_contains "T6.4 same TXN on another order rejected (409)" 'আগেই ব্যবহার' "$body"

# other user cannot submit payment to an order they don't own
code=$(http_code -X POST "$BASE/api/marketplace/orders/$ORDER_U2/payment" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"paymentMethodId\":\"$PM_ID\",\"senderNumber\":\"01722222222\",\"transactionId\":\"TXN-OTHER-$RANDOM\"}")
assert_eq "T6.5 payment submission owner-only (403)" "403" "$code"

# admin verifies manual payment
body=$(http_body -X PATCH "$BASE/api/admin/marketplace/orders/$ORDER_FRAC" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"verify_payment"}')
assert_contains "T6.6 admin verifies manual payment" '"success":true' "$body"
ST=$(dbq "SELECT status||'/'||paymentStatus FROM MarketplaceOrder WHERE id='$ORDER_FRAC'")
assert_eq "T6.7 manual order paid + queued" "queued/paid" "$ST"
body=$(http_body -X PATCH "$BASE/api/admin/marketplace/orders/$ORDER_FRAC" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"verify_payment"}')
assert_contains "T6.8 duplicate admin verify idempotent" 'alreadyPaid' "$body"

# non-admin cannot call admin order actions
code=$(http_code -X PATCH "$BASE/api/admin/marketplace/orders/$ORDER3" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d '{"action":"set_status","status":"completed"}')
assert_eq "T6.9 user cannot set order status (403)" "403" "$code"

# ── 8. Fulfilment lifecycle + guards ───────────────────────────
say ""
say "── [T7] fulfilment lifecycle ──"
body=$(http_body -X PATCH "$BASE/api/admin/marketplace/orders/$ORDER1" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"set_status","status":"processing","note":"Started","startCount":500,"remains":1500}')
assert_contains "T7.1 queued→processing" '"success":true' "$body"
body=$(http_body -X PATCH "$BASE/api/admin/marketplace/orders/$ORDER1" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"set_status","status":"in_progress"}')
assert_contains "T7.2 processing→in_progress" '"success":true' "$body"
body=$(http_body -X PATCH "$BASE/api/admin/marketplace/orders/$ORDER1" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"set_status","status":"completed","note":"Delivered fully"}')
assert_contains "T7.3 in_progress→completed" '"success":true' "$body"
body=$(http_body -X PATCH "$BASE/api/admin/marketplace/orders/$ORDER1" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"set_status","status":"queued"}')
assert_contains "T7.4 completed→queued rejected (guarded)" 'অনুমোদিত নয়' "$body"
ST=$(dbq "SELECT startCount||'/'||remains FROM MarketplaceOrder WHERE id='$ORDER1'")
assert_eq "T7.5 start/remains stored" "500/1500" "$ST"

# provider API removed — unknown/legacy actions must be rejected and leave the order untouched
body=$(http_body -X PATCH "$BASE/api/admin/marketplace/orders/$ORDER_FRAC" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"provider_submit"}')
assert_contains "T7.6 legacy provider_submit action rejected" 'Unknown action' "$body"
ST=$(dbq "SELECT status FROM MarketplaceOrder WHERE id='$ORDER_FRAC'")
assert_eq "T7.7 order unchanged after unknown action" "queued" "$ST"

# ── 9. Customer cancel ─────────────────────────────────────────
say ""
say "── [T8] customer cancellation ──"
body=$(http_body -X POST "$BASE/api/marketplace/orders/$ORDER3/cancel" -H "$USER1_COOKIE")
assert_contains "T8.1 unpaid order cancelled" '"success":true' "$body"
ST=$(dbq "SELECT status FROM MarketplaceOrder WHERE id='$ORDER3'")
assert_eq "T8.2 status=cancelled" "cancelled" "$ST"
code=$(http_code -X POST "$BASE/api/marketplace/orders/$ORDER3/cancel" -H "$USER1_COOKIE")
assert_eq "T8.3 double-cancel rejected (409)" "409" "$code"
code=$(http_code -X POST "$BASE/api/marketplace/orders/$ORDER1/cancel" -H "$USER1_COOKIE")
assert_eq "T8.4 paid order cannot be customer-cancelled (409)" "409" "$code"
code=$(http_code -X POST "$BASE/api/marketplace/orders/$ORDER_U2/cancel" -H "$USER1_COOKIE")
assert_eq "T8.5 cancel owner-only (403)" "403" "$code"

# ── 10. Deal regression ────────────────────────────────────────
say ""
say "── [T9] admin deal workflow regression ──"
body=$(http_body -X POST "$BASE/api/deals/create" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"title\":\"Regression deal\",\"role\":\"buyer\",\"amount\":500,\"partyEmail\":\"seller@demo.com\",\"terms\":\"test\"}")
assert_contains "T9.1 deal creation still works" '"status":"created"' "$body"
DEAL_ID=$(echo "$body" | jqval "d['id']" | tr -d '\r')
DST=$(dbq "SELECT status FROM Deal WHERE id='$DEAL_ID'")
assert_eq "T9.2 deal status=created (escrow intact)" "created" "$DST"
code=$(http_code "$BASE/api/products")
assert_eq "T9.3 products API still works" "200" "$code"
body=$(http_body "$BASE/api/marketplace/orders")
if echo "$body" | rg -q "Deal|escrow"; then fail "T9.4 no deal rows in marketplace orders" "mixed"; else pass "T9.4 marketplace orders separate from deals"; fi

# ── 10b. Category ON/OFF switches ─────────────────────────────
say ""
say "── [T9b] category on/off switches (admin-controlled) ──"
# clean slate — no row for a category means enabled (default-on contract)
dbx "DELETE FROM MarketplaceCategorySetting"

body=$(http_body -X POST "$BASE/api/admin/marketplace/services" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"name":"Spotify Plays","category":"spotify","description":"Premium plays","pricePerThousand":200,"minQuantity":100,"maxQuantity":50000,"status":"published"}')
assert_contains "T9b.1 admin creates published spotify service" '"success":true' "$body"
SVC_SPOTIFY=$(echo "$body" | jqval "d['service']['id']" | tr -d '\r')

body=$(http_body "$BASE/api/admin/marketplace/categories" -H "$ADMIN_COOKIE")
assert_contains "T9b.2 admin GET categories" '"success":true' "$body"
CNT=$(echo "$body" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['categories']))" 2>/dev/null)
assert_eq "T9b.3 all 17 platform categories returned" "17" "$CNT"
SPOT=$(echo "$body" | python3 -c "import sys,json;d=json.load(sys.stdin);c=[x for x in d['categories'] if x['categoryId']=='spotify'][0];print(c['enabled'],c['serviceCount'],sep='|')" 2>/dev/null)
assert_eq "T9b.4 spotify enabled with 1 visible service" "True|1" "$SPOT"

code=$(http_code "$BASE/api/admin/marketplace/categories")
assert_eq "T9b.5 anonymous admin categories denied (401)" "401" "$code"
code=$(http_code "$BASE/api/admin/marketplace/categories" -H "$USER1_COOKIE")
assert_eq "T9b.6 user admin categories denied (403)" "403" "$code"

code=$(http_code -X PATCH "$BASE/api/admin/marketplace/categories" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"categoryId":"not_a_platform","enabled":false}')
assert_eq "T9b.7 invalid category rejected (400)" "400" "$code"
code=$(http_code -X PATCH "$BASE/api/admin/marketplace/categories" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"categoryId":"spotify","enabled":"yes"}')
assert_eq "T9b.8 non-boolean enabled rejected (400)" "400" "$code"
code=$(http_code -X PATCH "$BASE/api/admin/marketplace/categories" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d '{"categoryId":"spotify","enabled":false}')
assert_eq "T9b.9 user cannot toggle category (403)" "403" "$code"

body=$(http_body -X PATCH "$BASE/api/admin/marketplace/categories" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"categoryId":"spotify","enabled":false}')
assert_contains "T9b.10 admin disables spotify" '"enabled":false' "$body"

body=$(http_body "$BASE/api/marketplace/categories")
if echo "$body" | rg -q '"spotify"'; then fail "T9b.11 public categories excludes spotify" "leaked"; else pass "T9b.11 public categories excludes spotify"; fi
assert_contains "T9b.12 public categories still lists facebook" '"facebook"' "$body"

body=$(http_body "$BASE/api/marketplace/services")
if echo "$body" | rg -q 'Spotify Plays'; then fail "T9b.13 disabled category excluded from catalog" "leaked"; else pass "T9b.13 disabled category excluded from catalog"; fi
body=$(http_body "$BASE/api/marketplace/services?category=spotify")
assert_eq "T9b.14 disabled category filter returns empty" "[]" "$(echo "$body" | jqval "d['services']" | tr -d '\r' | head -c 2)"

code=$(http_code "$BASE/api/marketplace/services/$SVC_SPOTIFY")
assert_eq "T9b.15 disabled category service detail 404" "404" "$code"

code=$(http_code -X POST "$BASE/api/marketplace/orders" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"serviceId\":\"$SVC_SPOTIFY\",\"quantity\":500,\"link\":\"https://open.spotify.com/x\",\"idempotencyKey\":\"idk-spotify-$RANDOM\"}")
assert_eq "T9b.16 order for disabled category rejected (400)" "400" "$code"
body=$(http_body -X POST "$BASE/api/marketplace/orders" -H "$USER1_COOKIE" -H 'Content-Type: application/json' -d "{\"serviceId\":\"$SVC_SPOTIFY\",\"quantity\":500,\"link\":\"https://open.spotify.com/x\",\"idempotencyKey\":\"idk-spotify2-$RANDOM\"}")
assert_contains "T9b.17 rejection explains category closed" 'ক্যাটাগরি' "$body"

# re-enable → everything comes back
body=$(http_body -X PATCH "$BASE/api/admin/marketplace/categories" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"categoryId":"spotify","enabled":true}')
assert_contains "T9b.18 admin re-enables spotify" '"enabled":true' "$body"
code=$(http_code "$BASE/api/marketplace/services/$SVC_SPOTIFY")
assert_eq "T9b.19 service detail available again (200)" "200" "$code"
body=$(http_body "$BASE/api/marketplace/categories")
assert_contains "T9b.20 public categories includes spotify again" '"spotify"' "$body"
body=$(place_order "$USER1_COOKIE" "$SVC_SPOTIFY" 500 "https://open.spotify.com/x" "idk-spotify3-$RANDOM" "")
assert_contains "T9b.21 order succeeds after re-enable" '"success":true' "$body"

# leave a clean state: default-on contract restored
dbx "DELETE FROM MarketplaceCategorySetting"
dbx "UPDATE MarketplaceService SET status='draft' WHERE id='$SVC_SPOTIFY'"

# ── 11. Health auto-create + summary ───────────────────────────
say ""
say "── [T10] summary ──"
CNT=$(dbq "SELECT COUNT(*) FROM MarketplaceOrderEvent")
say "  order events recorded: $CNT"
ORDN=$(dbq "SELECT COUNT(*) FROM MarketplaceOrder")
say "  orders created: $ORDN"

say ""
say "════════════════════════════════════════════════"
say " RESULTS: $PASS passed, $FAIL failed"
if [ $FAIL -gt 0 ]; then
  for n in "${FAILED_NAMES[@]}"; do say "   FAILED: $n"; done
fi
say "════════════════════════════════════════════════"
[ $FAIL -eq 0 ]
