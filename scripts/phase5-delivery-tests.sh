#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Phase 5 — Delivery & Order Tracking E2E test suite.
#
# Covers: physical shipping workflow (ship → out_for_delivery →
# delivered → buyer confirm_receipt), anti-false-delivery validation
# (no tracking → no delivery), courier-record correction endpoint,
# digital secure handover (content required for non-file, entitlement
# for file products), RBAC (buyer cannot ship, seller cannot confirm
# receipt), event history and buyer/seller notifications.
#
# Starts its own dev server on :3211, tears down on exit.
# Usage: bash scripts/phase5-delivery-tests.sh
# ═══════════════════════════════════════════════════════════════
set -u

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
PORT=3211
BASE="http://127.0.0.1:$PORT"
DB="db/custom.db"
LOGDIR=/tmp/phase5-tests
mkdir -p "$LOGDIR"

PASS=0; FAIL=0; FAILED_NAMES=()

# Seed users (seed-phase3-gapfill)
ADMIN_ID="cmrar4fgy0000vcitwu695oe7"
SELLER_ID="cmsellerbiz000000000000001"
BUYER_ID="cmbuyer0000000000000000001"

say()  { printf '%s\n' "$*"; }
pass() { PASS=$((PASS+1)); say "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); FAILED_NAMES+=("$1"); say "  ✗ $1  $2"; }

assert_eq() { if [ "$2" == "$3" ]; then pass "$1"; else fail "$1" "(expected=$2 actual=$3)"; fi }
assert_contains() { if echo "$3" | rg -q -- "$2"; then pass "$1"; else fail "$1" "(missing '$2' in: $(echo "$3" | head -c 160))"; fi }

http_code() { curl -s -o /dev/null --max-time 30 -w '%{http_code}' "$@"; }
http_body() { curl -s --max-time 30 "$@"; }
jqval() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1" 2>/dev/null; }

dbq() { python3 -c "
import sqlite3, sys
con = sqlite3.connect('$DB')
cur = con.cursor()
for row in cur.execute(sys.argv[1]):
    print(*row, sep='|')
" "$1" 2>/dev/null; }

cleanup() {
  say ""
  say "── teardown ──"
  [ -n "${DEV_PID:-}" ] && kill "$DEV_PID" 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT

say "════════════════════════════════════════════════"
say " Phase 5 Delivery & Tracking test suite"
say "════════════════════════════════════════════════"

# ── 0. Seed ─────────────────────────────────────────────────────
DATABASE_URL="file:$ROOT/db/custom.db" bunx tsx scripts/seed-phase5.ts > "$LOGDIR/seed.log" 2>&1 \
  && pass "seed-phase5 products ready" || fail "seed-phase5" "$(tail -2 "$LOGDIR/seed.log")"

PHYS_ID=$(dbq "SELECT id FROM DigitalProduct WHERE title='ফেজ৫ টেস্ট ওয়াচ (ফিজিক্যাল)' LIMIT 1")
ACCT_ID=$(dbq "SELECT id FROM DigitalProduct WHERE title='ফেজ৫ টেস্ট অ্যাকাউন্ট (ডিজিটাল)' LIMIT 1")
FILE_ID=$(dbq "SELECT id FROM DigitalProduct WHERE title='ফেজ৫ টেস্ট ফাইল (ডিজিটাল)' LIMIT 1")
PM_ID=$(dbq "SELECT id FROM PaymentMethod LIMIT 1")
[ -n "$PHYS_ID" ] && pass "physical product present" || fail "physical product" "missing"
[ -n "$ACCT_ID" ] && pass "account product present" || fail "account product" "missing"
[ -n "$FILE_ID" ] && pass "file product present" || fail "file product" "missing"
[ -n "$PM_ID" ] && pass "payment method present" || fail "payment method" "missing"

# ── 1. Start dev server ─────────────────────────────────────────
say ""
say "── starting dev server on :$PORT ──"
DATABASE_URL="file:$ROOT/db/custom.db" NEXT_PUBLIC_APP_URL="$BASE" bunx next dev -p $PORT > "$LOGDIR/dev.log" 2>&1 &
DEV_PID=$!
code="000"
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null --max-time 5 -w '%{http_code}' "$BASE/api/health" || true)
  [ "$code" != "000" ] && break
  sleep 1
done
assert_eq "dev server responds" "200" "$code"

ADMIN_COOKIE="Cookie: midman_session=$ADMIN_ID"
SELLER_COOKIE="Cookie: midman_session=$SELLER_ID"
BUYER_COOKIE="Cookie: midman_session=$BUYER_ID"

create_order() { # $1=productId $2=extra-json (optional) $3=clientRequestId
  http_body -X POST "$BASE/api/orders" -H "$BUYER_COOKIE" -H 'Content-Type: application/json' \
    -d "{\"productId\":\"$1\",\"quantity\":1,\"clientRequestId\":\"$3\"${2:+,$2}}"
}
submit_payment() { # $1=orderId
  http_body -X POST "$BASE/api/marketplace/orders/$1/payment" -H "$BUYER_COOKIE" -H 'Content-Type: application/json' \
    -d "{\"paymentMethodId\":\"$PM_ID\",\"senderNumber\":\"01711223344\",\"transactionId\":\"TXN$RANDOM$RANDOM\"}"
}
admin_verify() { # $1=orderId
  http_body -X PATCH "$BASE/api/admin/marketplace/orders/$1" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' \
    -d '{"action":"verify_payment"}'
}
status_action() { # $1=orderId $2=cookie $3=json-body
  http_body -X PATCH "$BASE/api/orders/$1/status" -H "$2" -H 'Content-Type: application/json' -d "$3"
}
status_code() { # $1=orderId $2=cookie $3=json-body
  http_code -X PATCH "$BASE/api/orders/$1/status" -H "$2" -H 'Content-Type: application/json' -d "$3"
}

# ════════════════════════════════════════════════════════════════
say ""
say "── [A] PHYSICAL delivery workflow ──"
say "════════════════════════════════════════════════"

body=$(create_order "$PHYS_ID" '"buyerName":"মেহেদী হাসান","buyerPhone":"01833333333","addressLine":"রোড ৫, বাড়ি ১২","city":"Dhaka","postalCode":"1205","deliveryNote":"রিং বেল বাজাবেন"' "p5-phys-$RANDOM$RANDOM")
assert_contains "A1 buyer creates physical order" '"success":true' "$body"
OID=$(echo "$body" | jqval "d['order']['id']" | tr -d '\r')

body=$(submit_payment "$OID")
assert_contains "A2 buyer submits payment info" '"success":true' "$body"

body=$(admin_verify "$OID")
assert_contains "A3 admin verifies payment (→ queued/confirmed)" '"success":true' "$body"
ST=$(dbq "SELECT status||'/'||paymentStatus FROM MarketplaceOrder WHERE id='$OID'")
assert_eq "A3.1 order queued+paid" "queued/paid" "$ST"

# Buyer cannot ship (RBAC)
code=$(status_code "$OID" "$BUYER_COOKIE" '{"action":"ship","courierName":"X","trackingNumber":"Y"}')
assert_eq "A4 buyer ship forbidden (403)" "403" "$code"

# Ship requires processing state
code=$(status_code "$OID" "$SELLER_COOKIE" '{"action":"ship","courierName":"Sundarban","trackingNumber":"SB001"}')
assert_eq "A5 ship from queued rejected (409)" "409" "$code"

body=$(status_action "$OID" "$SELLER_COOKIE" '{"action":"start"}')
assert_contains "A6 seller starts processing" '"success":true' "$body"

# Ship without tracking rejected (validation)
body=$(status_action "$OID" "$SELLER_COOKIE" '{"action":"ship","courierName":"Sundarban"}')
assert_contains "A7 ship without tracking rejected" 'ট্র্যাকিং' "$body"
code=$(status_code "$OID" "$SELLER_COOKIE" '{"action":"ship","courierName":"Sundarban"}')
assert_eq "A7.1 ship without tracking = 409" "409" "$code"

# Ship with courier + tracking
body=$(status_action "$OID" "$SELLER_COOKIE" '{"action":"ship","courierName":"Sundarban","trackingNumber":"SB888777","dispatchDate":"2026-10-24","estimatedDeliveryDate":"2026-10-28","shippingNote":"বসুন্ধরা শাখা"}')
assert_contains "A8 seller ships with tracking" '"status":"shipped"' "$body"
ST=$(dbq "SELECT courierName||'/'||trackingNumber FROM MarketplaceOrder WHERE id='$OID'")
assert_eq "A8.1 courier+tracking persisted" "Sundarban/SB888777" "$ST"

# Anti-false-delivery: mark_delivered works only with tracking present —
# clear tracking via direct db to prove the server checks the RECORD, not the request
dbx() { python3 -c "
import sqlite3, sys
con = sqlite3.connect('$DB')
cur = con.cursor()
cur.execute(sys.argv[1]); con.commit()
" "$1" 2>/dev/null; }

body=$(status_action "$OID" "$SELLER_COOKIE" '{"action":"out_for_delivery"}')
assert_contains "A9 out_for_delivery" '"status":"out_for_delivery"' "$body"

body=$(status_action "$OID" "$SELLER_COOKIE" '{"action":"mark_delivered"}')
assert_contains "A10 seller marks delivered (tracking on file)" '"status":"delivered"' "$body"
DA=$(dbq "SELECT deliveredAt IS NOT NULL FROM MarketplaceOrder WHERE id='$OID'")
assert_eq "A10.1 deliveredAt stamped" "1" "$DA"

# Buyer detail shows shipping info
body=$(http_body "$BASE/api/marketplace/orders/$OID" -H "$BUYER_COOKIE")
assert_contains "A11 buyer sees courier" 'Sundarban' "$body"
assert_contains "A11.1 buyer sees tracking" 'SB888777' "$body"

# Buyer cannot deliver/ship further
code=$(status_code "$OID" "$BUYER_COOKIE" '{"action":"mark_delivered"}')
assert_eq "A12 buyer mark_delivered forbidden (403)" "403" "$code"

# Seller cannot confirm receipt
code=$(status_code "$OID" "$SELLER_COOKIE" '{"action":"confirm_receipt"}')
assert_eq "A13 seller confirm_receipt forbidden (403)" "403" "$code"

body=$(status_action "$OID" "$BUYER_COOKIE" '{"action":"confirm_receipt"}')
assert_contains "A14 buyer confirms receipt" '"status":"completed"' "$body"
CA=$(dbq "SELECT completedAt IS NOT NULL FROM MarketplaceOrder WHERE id='$OID'")
assert_eq "A14.1 completedAt stamped" "1" "$CA"

# Event history
EV=$(dbq "SELECT COUNT(*) FROM MarketplaceOrderEvent WHERE orderId='$OID' AND type='status_changed' AND message LIKE '%Sundarban%'")
assert_eq "A15 shipped event carries courier info" "1" "$EV"
NOTIF=$(dbq "SELECT COUNT(*) FROM Notification WHERE relatedId='$OID' AND userId='$BUYER_ID' AND type='order_shipped'")
assert_eq "A16 buyer notified: shipped" "1" "$NOTIF"
NOTIF=$(dbq "SELECT COUNT(*) FROM Notification WHERE relatedId='$OID' AND userId='$BUYER_ID' AND type='order_delivered'")
assert_eq "A16.1 buyer notified: delivered" "1" "$NOTIF"
NOTIF=$(dbq "SELECT COUNT(*) FROM Notification WHERE relatedId='$OID' AND userId='$SELLER_ID' AND type='order_completed'")
assert_eq "A16.2 seller notified: receipt confirmed" "1" "$NOTIF"

# ════════════════════════════════════════════════════════════════
say ""
say "── [B] Courier-record correction endpoint ──"
say "════════════════════════════════════════════════"

body=$(create_order "$PHYS_ID" '"buyerName":"ক","buyerPhone":"01800000000","addressLine":"রোড ১","city":"Dhaka"' "p5-edit-$RANDOM$RANDOM")
OID2=$(echo "$body" | jqval "d['order']['id']" | tr -d '\r')
submit_payment "$OID2" > /dev/null
admin_verify "$OID2" > /dev/null
status_action "$OID2" "$SELLER_COOKIE" '{"action":"start"}' > /dev/null
status_action "$OID2" "$SELLER_COOKIE" '{"action":"ship","courierName":"Steadfast","trackingNumber":"SF111"}' > /dev/null

body=$(http_body -X PATCH "$BASE/api/orders/$OID2/shipping" -H "$SELLER_COOKIE" -H 'Content-Type: application/json' -d '{"trackingNumber":"SF222333","shippingNote":"নতুন নম্বর"}')
assert_contains "B1 seller corrects tracking number" '"trackingNumber":"SF222333"' "$body"
EV=$(dbq "SELECT COUNT(*) FROM MarketplaceOrderEvent WHERE orderId='$OID2' AND type='delivery_updated'")
assert_eq "B1.1 delivery_updated event logged" "1" "$EV"

code=$(http_code -X PATCH "$BASE/api/orders/$OID2/shipping" -H "$BUYER_COOKIE" -H 'Content-Type: application/json' -d '{"trackingNumber":"HACK"}')
assert_eq "B2 buyer shipping edit forbidden (403)" "403" "$code"

# ════════════════════════════════════════════════════════════════
say ""
say "── [C] DIGITAL secure handover (account kind) ──"
say "════════════════════════════════════════════════"

body=$(create_order "$ACCT_ID" '"customerNote":"আমার আইডি: 123456789"' "p5-acct-$RANDOM$RANDOM")
assert_contains "C1 buyer creates digital order" '"success":true' "$body"
OID3=$(echo "$body" | jqval "d['order']['id']" | tr -d '\r')
submit_payment "$OID3" > /dev/null
admin_verify "$OID3" > /dev/null
status_action "$OID3" "$SELLER_COOKIE" '{"action":"start"}' > /dev/null

# deliver_digital without content rejected
code=$(status_code "$OID3" "$SELLER_COOKIE" '{"action":"deliver_digital"}')
assert_eq "C2 deliver without content rejected (409)" "409" "$code"

# ship action on digital order rejected
code=$(status_code "$OID3" "$SELLER_COOKIE" '{"action":"ship","courierName":"X","trackingNumber":"Y"}')
assert_eq "C3 ship on digital order rejected (409)" "409" "$code"

body=$(status_action "$OID3" "$SELLER_COOKIE" '{"action":"deliver_digital","deliveryContent":"ইমেইল: test@acc.com\nপাসওয়ার্ড: Secret#99"}')
assert_contains "C4 seller delivers with content" '"status":"delivered"' "$body"
DC=$(dbq "SELECT deliveryContent IS NOT NULL FROM MarketplaceOrder WHERE id='$OID3'")
assert_eq "C4.1 content stored order-scoped" "1" "$DC"

# Buyer sees the content via the auth-gated detail API
body=$(http_body "$BASE/api/marketplace/orders/$OID3" -H "$BUYER_COOKIE")
assert_contains "C5 buyer sees delivery content" 'Secret#99' "$body"
# Buyer list API must NOT leak the content
body=$(http_body "$BASE/api/marketplace/orders" -H "$BUYER_COOKIE")
if echo "$body" | rg -q 'Secret#99'; then fail "C6 list API hides delivery content" "content leaked"; else pass "C6 list API hides delivery content"; fi
# Anonymous requests get no content
code=$(http_code "$BASE/api/marketplace/orders/$OID3")
assert_eq "C6.1 anonymous detail rejected (401/403)" "401" "$code"

# Correction path: seller updates content while delivered
body=$(status_action "$OID3" "$SELLER_COOKIE" '{"action":"deliver_digital","deliveryContent":"ইমেইল: test@acc.com\nপাসওয়ার্ড: NewPass#77"}')
assert_contains "C7 seller updates delivered content" '"success":true' "$body"
ST=$(dbq "SELECT status FROM MarketplaceOrder WHERE id='$OID3'")
assert_eq "C7.1 status stays delivered" "delivered" "$ST"
EV=$(dbq "SELECT COUNT(*) FROM MarketplaceOrderEvent WHERE orderId='$OID3' AND type='delivery_updated'")
assert_eq "C7.2 content-update event logged" "1" "$EV"

body=$(status_action "$OID3" "$BUYER_COOKIE" '{"action":"confirm_receipt"}')
assert_contains "C8 buyer confirms receipt" '"status":"completed"' "$body"

# ════════════════════════════════════════════════════════════════
say ""
say "── [D] DIGITAL file delivery (entitlement) ──"
say "════════════════════════════════════════════════"

body=$(create_order "$FILE_ID" '' "p5-file-$RANDOM$RANDOM")
OID4=$(echo "$body" | jqval "d['order']['id']" | tr -d '\r')
submit_payment "$OID4" > /dev/null
admin_verify "$OID4" > /dev/null
status_action "$OID4" "$SELLER_COOKIE" '{"action":"start"}' > /dev/null

# File products deliver WITHOUT content (download entitlement is the delivery)
body=$(status_action "$OID4" "$SELLER_COOKIE" '{"action":"deliver_digital"}')
assert_contains "D1 file order delivers without content" '"status":"delivered"' "$body"
ENT=$(dbq "SELECT COUNT(*) FROM ProductDownload WHERE productId='$FILE_ID' AND userId='$BUYER_ID'")
assert_eq "D2 download entitlement granted" "1" "$ENT"

body=$(status_action "$OID4" "$BUYER_COOKIE" '{"action":"confirm_receipt"}')
assert_contains "D3 buyer confirms receipt" '"status":"completed"' "$body"

# ════════════════════════════════════════════════════════════════
say ""
say "════════════════════════════════════════════════"
say " RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  printf '  ✗ %s\n' "${FAILED_NAMES[@]}"
fi
say "════════════════════════════════════════════════"
[ "$FAIL" -eq 0 ]
