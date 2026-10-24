#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Phase 6 — Buyer Protection E2E test suite.
#
# Covers: cancellation requests (create/duplicate/decide/admin-only
# on unverified payment/approve→refund spawn), refund workflow
# (eligibility, amount cap, duplicates, admin review chain,
# verified mark_refunded, order flip to refunded), disputes
# (buyer+seller create, category, thread messages, admin resolve
# with resume-on-rejected), RBAC, order-detail embedding, audit
# log and notifications.
#
# Starts its own dev server on :3212, tears down on exit.
# Usage: bash scripts/phase6-protection-tests.sh
# ═══════════════════════════════════════════════════════════════
set -u

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
PORT=3212
BASE="http://127.0.0.1:$PORT"
DB="db/custom.db"
LOGDIR=/tmp/phase6-tests
mkdir -p "$LOGDIR"

PASS=0; FAIL=0; FAILED_NAMES=()

say()  { printf '%s\n' "$*"; }
pass() { PASS=$((PASS+1)); say "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); FAILED_NAMES+=("$1"); say "  ✗ $1  $2"; }

assert_eq() { if [ "$2" == "$3" ]; then pass "$1"; else fail "$1" "(expected=$2 actual=$3)"; fi }
assert_contains() { if echo "$3" | rg -q -- "$2"; then pass "$1"; else fail "$1" "(missing '$2' in: $(echo "$3" | head -c 200))"; fi }

http_code() { curl -s -o /dev/null --max-time 60 -w '%{http_code}' "$@"; }
http_body() { curl -s --max-time 60 "$@"; }
jqval() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1" 2>/dev/null; }

dbq() { python3 -c "
import sqlite3, sys
con = sqlite3.connect('file:$DB?mode=ro', uri=True, timeout=15)
con.execute('PRAGMA busy_timeout=15000')
cur = con.cursor()
for row in cur.execute(sys.argv[1]):
    print(*row, sep='|')
con.close()
" "$1" 2>/dev/null; }

dbw() { python3 -c "
import sqlite3, sys
con = sqlite3.connect('$DB', timeout=20)
con.execute('PRAGMA busy_timeout=20000')
con.execute(sys.argv[1]); con.commit(); con.close()
" "$1" 2>&1 | head -1; }

cleanup() {
  say ""
  say "── teardown ──"
  [ -n "${DEV_PID:-}" ] && kill "$DEV_PID" 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT

say "════════════════════════════════════════════════"
say " Phase 6 Buyer Protection test suite"
say "════════════════════════════════════════════════"

# ── 0. Seed + fresh protection state (BEFORE server start) ─────
DATABASE_URL="file:$ROOT/db/custom.db" bunx tsx scripts/seed-phase3-gapfill.ts > "$LOGDIR/seed.log" 2>&1 \
  && pass "seed-phase3 users/orders ready" || fail "seed-phase3" "$(tail -2 "$LOGDIR/seed.log")"

ADMIN_ID="cmrar4fgy0000vcitwu695oe7"
SELLER_ID="cmsellerbiz000000000000001"
BUYER2_ID="cmbuyer0000000000000000002"

dbw "DELETE FROM OrderCancellationRequest;"
dbw "DELETE FROM RefundRequest;"
dbw "DELETE FROM OrderDisputeMessage;"
dbw "DELETE FROM OrderDispute;"
dbw "DELETE FROM AdminAuditLog;"

OP1=$(dbq "SELECT id FROM MarketplaceOrder WHERE orderNumber='MD-P3-0001'")  # pending_payment + unpaid
OP2=$(dbq "SELECT id FROM MarketplaceOrder WHERE orderNumber='MD-P3-0002'")  # queued + paid (physical)
OP3=$(dbq "SELECT id FROM MarketplaceOrder WHERE orderNumber='MD-P3-0003'")  # processing + paid (physical)
OP5=$(dbq "SELECT id FROM MarketplaceOrder WHERE orderNumber='MD-P3-0005'")  # completed + paid (physical)
[ -n "$OP1" ] && [ -n "$OP5" ] && pass "orders present" || fail "orders" "missing"

# Per-order buyers (the seed alternates buyers!) + reset terminal states
B1=$(dbq "SELECT userId FROM MarketplaceOrder WHERE id='$OP1'")
B2=$(dbq "SELECT userId FROM MarketplaceOrder WHERE id='$OP2'")
B3=$(dbq "SELECT userId FROM MarketplaceOrder WHERE id='$OP3'")
B5=$(dbq "SELECT userId FROM MarketplaceOrder WHERE id='$OP5'")
say "  buyers: OP1=$B1 OP2=$B2 OP3=$B3 OP5=$B5"

dbw "UPDATE MarketplaceOrder SET status='pending_payment', paymentStatus='unpaid', cancelledAt=NULL, cancelledBy=NULL, cancelReason=NULL, refundedAt=NULL WHERE id='$OP1';"
dbw "UPDATE MarketplaceOrder SET status='queued', paymentStatus='paid', refundedAt=NULL, disputeReason=NULL, disputedAt=NULL WHERE id='$OP2';"
dbw "UPDATE MarketplaceOrder SET status='processing', paymentStatus='paid', refundedAt=NULL, disputeReason=NULL, disputedAt=NULL WHERE id='$OP3';"
dbw "UPDATE MarketplaceOrder SET status='completed', paymentStatus='paid', refundedAt=NULL, disputeReason=NULL, disputedAt=NULL WHERE id='$OP5';"

ADMIN_COOKIE="Cookie: midman_session=$ADMIN_ID"
SELLER_COOKIE="Cookie: midman_session=$SELLER_ID"
B1_COOKIE="Cookie: midman_session=$B1"
B2_COOKIE="Cookie: midman_session=$B2"
B3_COOKIE="Cookie: midman_session=$B3"
B5_COOKIE="Cookie: midman_session=$B5"
NOPARTY_COOKIE="Cookie: midman_session=cmbuyer0000000000000000001"  # buyer1 — party only on OP1/OP3

# ── 1. Start dev server ─────────────────────────────────────────
say ""
say "── starting dev server on :$PORT ──"
DATABASE_URL="file:$ROOT/db/custom.db" NEXT_PUBLIC_APP_URL="$BASE" bunx next dev -p $PORT > "$LOGDIR/dev.log" 2>&1 &
DEV_PID=$!
code="000"
for i in $(seq 1 120); do
  code=$(curl -s -o /dev/null --max-time 5 -w '%{http_code}' "$BASE/api/health" || true)
  [ "$code" == "200" ] && break
  sleep 1
done
assert_eq "dev server responds (200)" "200" "$code"

# ── 2. Cancellation requests ────────────────────────────────────
say ""
say "── cancellation requests ──"

# 2.1 unpaid order → request blocked (direct cancel exists)
code=$(http_code -X POST "$BASE/api/orders/$OP1/cancellation-request" -H "$B1_COOKIE" -H 'Content-Type: application/json' -d '{"reason":"changed my mind"}')
assert_eq "unpaid order blocks cancellation request (409)" "409" "$code"

# 2.2 buyer submits payment → awaiting_verification
PM_ID=$(dbq "SELECT id FROM PaymentMethod LIMIT 1")
body=$(http_body -X POST "$BASE/api/marketplace/orders/$OP1/payment" -H "$B1_COOKIE" -H 'Content-Type: application/json' \
  -d "{\"paymentMethodId\":\"$PM_ID\",\"senderNumber\":\"01700000001\",\"transactionId\":\"PH6TXN$RANDOM\"}")
assert_contains "payment submitted → awaiting_verification" '"success":true' "$body"

# 2.3 cancellation request on awaiting_verification order
body=$(http_body -X POST "$BASE/api/orders/$OP1/cancellation-request" -H "$B1_COOKIE" -H 'Content-Type: application/json' -d '{"reason":"অর্ডারটি ভুল হয়েছে"}')
assert_contains "cancellation request created" '"success":true' "$body"

# 2.4 duplicate blocked
code=$(http_code -X POST "$BASE/api/orders/$OP1/cancellation-request" -H "$B1_COOKIE" -H 'Content-Type: application/json' -d '{"reason":"again"}')
assert_eq "duplicate cancellation request blocked (409)" "409" "$code"

# 2.5 seller decision on awaiting_verification → admin-only (409)
code=$(http_code -X PATCH "$BASE/api/orders/$OP1/cancellation-request" -H "$SELLER_COOKIE" -H 'Content-Type: application/json' -d '{"action":"approve"}')
assert_eq "seller cannot approve unverified-payment cancellation (409)" "409" "$code"

# 2.6 non-party cannot decide
code=$(http_code -X PATCH "$BASE/api/orders/$OP1/cancellation-request" -H "$NOPARTY_COOKIE" -H 'Content-Type: application/json' -d '{"action":"approve"}')
assert_eq "non-party cannot decide (403)" "403" "$code"

# 2.7 admin approves → order cancelled + payment failed (never "paid")
body=$(http_body -X PATCH "$BASE/api/orders/$OP1/cancellation-request" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"approve","note":"অযাচাইকৃত পেমেন্ট"}')
assert_contains "admin approves unverified cancellation" '"success":true' "$body"
row=$(dbq "SELECT status, paymentStatus FROM MarketplaceOrder WHERE id='$OP1'")
assert_eq "order cancelled + payment voided (failed)" "cancelled|failed" "$row"

# 2.8 cancellation request on PAID order (processing) → seller approves → refund spawned
body=$(http_body -X POST "$BASE/api/orders/$OP3/cancellation-request" -H "$B3_COOKIE" -H 'Content-Type: application/json' -d '{"reason":"আর দরকার নেই"}')
assert_contains "paid-order cancellation request created" '"success":true' "$body"
body=$(http_body -X PATCH "$BASE/api/orders/$OP3/cancellation-request" -H "$SELLER_COOKIE" -H 'Content-Type: application/json' -d '{"action":"approve"}')
assert_contains "seller approves paid cancellation" '"success":true' "$body"
assert_contains "approval returns refundRequestId" 'refundRequestId' "$body"
row=$(dbq "SELECT status FROM MarketplaceOrder WHERE id='$OP3'")
assert_eq "paid order NOT cancelled yet (still processing)" "processing" "$row"
row=$(dbq "SELECT status FROM RefundRequest WHERE orderId='$OP3'")
assert_eq "refund request spawned (requested)" "requested" "$row"

# ── 3. Refund workflow ──────────────────────────────────────────
say ""
say "── refund workflow ──"

# 3.1 refund on non-paid order → blocked
code=$(http_code -X POST "$BASE/api/refunds" -H "$B1_COOKIE" -H 'Content-Type: application/json' -d "{\"orderId\":\"$OP1\",\"reason\":\"x\",\"amount\":10}")
assert_eq "refund on non-paid order blocked (409)" "409" "$code"

# 3.2 refund amount above paid total → 400
code=$(http_code -X POST "$BASE/api/refunds" -H "$B5_COOKIE" -H 'Content-Type: application/json' -d "{\"orderId\":\"$OP5\",\"reason\":\"damaged box\",\"amount\":99999}")
assert_eq "refund above paid total blocked (400)" "400" "$code"

# 3.3 forged evidence keys sanitized away
body=$(http_body -X POST "$BASE/api/refunds" -H "$B5_COOKIE" -H 'Content-Type: application/json' \
  -d "{\"orderId\":\"$OP5\",\"reason\":\"পণ্য ক্ষতিগ্রস্ত\",\"amount\":100,\"evidence\":[{\"key\":\"../etc/passwd\",\"fileName\":\"x\"},{\"key\":\"chat/other/f.png\",\"fileName\":\"y\"}]}")
assert_contains "refund request created (completed physical)" '"success":true' "$body"
ev=$(echo "$body" | jqval "d['request']['evidence']")
assert_eq "foreign evidence keys sanitized to null" "None" "$ev"

# 3.4 duplicate refund blocked
code=$(http_code -X POST "$BASE/api/refunds" -H "$B5_COOKIE" -H 'Content-Type: application/json' -d "{\"orderId\":\"$OP5\",\"reason\":\"dup\",\"amount\":100}")
assert_eq "duplicate refund request blocked (409)" "409" "$code"

# 3.5 admin reject the OP5 refund
RID5=$(dbq "SELECT id FROM RefundRequest WHERE orderId='$OP5'")
body=$(http_body -X PATCH "$BASE/api/admin/refunds/$RID5" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"reject","note":"প্রমাণ অপর্যাপ্ত"}')
assert_contains "admin rejects refund" '"success":true' "$body"
code=$(http_code -X PATCH "$BASE/api/admin/refunds/$RID5" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"approve"}')
assert_eq "rejected refund is terminal (409)" "409" "$code"

# 3.6 full admin chain on the OP3 (cancellation-spawned) refund
RID3=$(dbq "SELECT id FROM RefundRequest WHERE orderId='$OP3'")
body=$(http_body -X PATCH "$BASE/api/admin/refunds/$RID3" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"request_info","note":"রিফান্ড রসিদ দিন"}')
assert_contains "admin requests additional info" '"success":true' "$body"
body=$(http_body -X PATCH "$BASE/api/admin/refunds/$RID3" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"approve"}')
assert_contains "admin approves refund" '"success":true' "$body"
body=$(http_body -X PATCH "$BASE/api/admin/refunds/$RID3" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"start_processing","refundMethod":"bKash"}')
assert_contains "admin starts processing" '"success":true' "$body"

# mark_refunded without reference → 400
code=$(http_code -X PATCH "$BASE/api/admin/refunds/$RID3" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"mark_refunded"}')
assert_eq "mark_refunded requires reference (400)" "400" "$code"

body=$(http_body -X PATCH "$BASE/api/admin/refunds/$RID3" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"mark_refunded","refundReference":"RF-REF-9981","refundMethod":"bKash"}')
assert_contains "admin marks refunded with verified reference" '"success":true' "$body"
row=$(dbq "SELECT status FROM RefundRequest WHERE orderId='$OP3'")
assert_eq "refund status = refunded" "refunded" "$row"
row=$(dbq "SELECT status, refundedAt IS NOT NULL FROM MarketplaceOrder WHERE id='$OP3'")
assert_eq "order flipped to refunded" "refunded|1" "$row"

# 3.7 duplicate mark_refunded → 409
code=$(http_code -X PATCH "$BASE/api/admin/refunds/$RID3" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"mark_refunded","refundReference":"RF-AGAIN"}')
assert_eq "refund completion is terminal (409)" "409" "$code"

# ── 4. Disputes ─────────────────────────────────────────────────
say ""
say "── disputes ──"

# 4.1 unpaid dispute blocked
code=$(http_code -X POST "$BASE/api/orders/$OP1/disputes" -H "$B1_COOKIE" -H 'Content-Type: application/json' -d '{"category":"other","description":"x"}')
assert_eq "dispute on non-paid order blocked (409)" "409" "$code"

# 4.2 buyer opens categorized dispute on queued+paid order
body=$(http_body -X POST "$BASE/api/orders/$OP2/disputes" -H "$B2_COOKIE" -H 'Content-Type: application/json' \
  -d '{"category":"item_not_received","description":"৭ দিন হলো পণ্য আসেনি","evidence":[{"key":"evidence/x/y.png","fileName":"y.png"}]}')
assert_contains "buyer dispute created" '"success":true' "$body"
row=$(dbq "SELECT status, preDisputeStatus FROM OrderDispute WHERE orderId='$OP2'")
assert_eq "dispute row open (pre=queued)" "open|queued" "$row"
row=$(dbq "SELECT status FROM MarketplaceOrder WHERE id='$OP2'")
assert_eq "order flipped to disputed" "disputed" "$row"

# 4.3 second dispute blocked (unique per order)
code=$(http_code -X POST "$BASE/api/orders/$OP2/disputes" -H "$B2_COOKIE" -H 'Content-Type: application/json' -d '{"category":"other","description":"again"}')
assert_eq "one dispute per order (409)" "409" "$code"

# 4.4 seller posts to the thread
DID=$(dbq "SELECT id FROM OrderDispute WHERE orderId='$OP2'")
body=$(http_body -X POST "$BASE/api/orders/$OP2/disputes/$DID/messages" -H "$SELLER_COOKIE" -H 'Content-Type: application/json' -d '{"text":"কুরিয়ারে বুঝে নিয়েছি, চেক করছি"}')
assert_contains "seller posts dispute message" '"success":true' "$body"

# 4.5 admin posts to the thread
body=$(http_body -X POST "$BASE/api/orders/$OP2/disputes/$DID/messages" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"text":"প্রমাণ যাচাই করা হচ্ছে"}')
assert_contains "admin posts dispute message" '"success":true' "$body"

# 4.6 admin resolves as rejected → order resumes queued
body=$(http_body -X PATCH "$BASE/api/admin/order-disputes/$DID" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' \
  -d '{"action":"resolve","outcome":"rejected","resolution":"কুরিয়ার ট্র্যাকিং অনুযায়ী ডেলিভারি সম্পন্ন"}')
assert_contains "admin resolves dispute (rejected)" '"success":true' "$body"
row=$(dbq "SELECT status FROM OrderDispute WHERE orderId='$OP2'")
assert_eq "dispute status = rejected" "rejected" "$row"
row=$(dbq "SELECT status FROM MarketplaceOrder WHERE id='$OP2'")
assert_eq "order resumed to pre-dispute status" "queued" "$row"

# 4.7 seller-raised dispute on completed order (stands alone, no flip)
body=$(http_body -X POST "$BASE/api/orders/$OP5/disputes" -H "$SELLER_COOKIE" -H 'Content-Type: application/json' \
  -d '{"category":"other","description":"সম্পন্ন অর্ডারে অভিযোগ","evidence":[]}')
assert_contains "seller dispute on completed order created" '"success":true' "$body"
row=$(dbq "SELECT status FROM MarketplaceOrder WHERE id='$OP5'")
assert_eq "completed order stays completed" "completed" "$row"

# ── 5. Order detail embedding + RBAC ────────────────────────────
say ""
say "── order detail embedding + RBAC ──"

body=$(http_body "$BASE/api/marketplace/orders/$OP2" -H "$B2_COOKIE")
assert_contains "detail embeds dispute" '"dispute"' "$body"
assert_contains "detail embeds cancellationRequest field" '"cancellationRequest"' "$body"
assert_contains "detail embeds refundRequest field" '"refundRequest"' "$body"

code=$(http_code "$BASE/api/marketplace/orders/$OP2" -H "$NOPARTY_COOKIE")
assert_eq "non-party detail access denied (403)" "403" "$code"

code=$(http_code "$BASE/api/admin/refunds" -H "$B2_COOKIE")
assert_eq "buyer blocked from admin refund list (403)" "403" "$code"

code=$(http_code "$BASE/api/admin/order-audit")
assert_eq "anonymous blocked from audit (401)" "401" "$code"

# ── 6. Audit log + notifications ────────────────────────────────
say ""
say "── audit log + notifications ──"

body=$(http_body "$BASE/api/admin/order-audit" -H "$ADMIN_COOKIE")
assert_contains "audit: cancellation_approve_unverified" 'cancellation_approve_unverified' "$body"
assert_contains "audit: refund_completed" 'refund_completed' "$body"
assert_contains "audit: dispute_reject" 'dispute_reject' "$body"

n=$(dbq "SELECT count(*) FROM Notification WHERE type='order_refund_update'")
[ "${n:-0}" -ge 1 ] && pass "buyer refund notifications created ($n)" || fail "refund notifications" "none found"
n=$(dbq "SELECT count(*) FROM Notification WHERE type='order_dispute_resolved'")
[ "${n:-0}" -ge 1 ] && pass "dispute resolution notifications created ($n)" || fail "dispute notifications" "none found"
n=$(dbq "SELECT count(*) FROM MarketplaceOrderEvent WHERE type='refund_requested'")
[ "${n:-0}" -ge 1 ] && pass "order events logged for refund request ($n)" || fail "refund events" "none found"
n=$(dbq "SELECT count(*) FROM MarketplaceOrderEvent WHERE type='cancellation_approved'")
[ "${n:-0}" -ge 1 ] && pass "order events logged for cancellation approval ($n)" || fail "cancellation events" "none found"

# ── Summary ─────────────────────────────────────────────────────
say ""
say "════════════════════════════════════════════════"
say " PASS: $PASS   FAIL: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  say " Failed:"
  for f in "${FAILED_NAMES[@]}"; do say "  - $f"; done
fi
say "════════════════════════════════════════════════"
[ "$FAIL" -eq 0 ]
