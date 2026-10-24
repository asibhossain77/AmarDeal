#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Phase 7 — Seller Analytics, Earnings & Payout E2E test suite.
#
# Covers: ledger backfill (idempotent, correct refs), commission
# config API (validation + audit), order completion → sale +
# commission snapshot, verified refund → refund + commission
# reversal, balance math (marketplace vs deals), payout workflow
# (reference REQUIRED, duplicate blocked, ledger + audit + notify),
# admin adjustments (ledger + audit + notify), RBAC (seller-only
# analytics/ledger, support admin denied finance APIs), analytics
# aggregates + ledger filters.
#
# Starts its own dev server on :3212, tears down on exit.
# Usage: bash scripts/phase7-earnings-tests.sh
# ═══════════════════════════════════════════════════════════════
set -u

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
PORT=3212
BASE="http://127.0.0.1:$PORT"
DB="db/custom.db"
LOGDIR=/tmp/phase7-tests
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
  # remove RBAC test admin + test notifications
  dbw "DELETE FROM Admin WHERE id='phase7-support-admin';" >/dev/null 2>&1
  dbw "DELETE FROM Notification WHERE type IN ('seller_payout_completed','ledger_adjustment') AND relatedType IN ('withdrawal','ledger') AND relatedId LIKE '%';" >/dev/null 2>&1
  wait 2>/dev/null
}
trap cleanup EXIT

say "════════════════════════════════════════════════"
say " Phase 7 Seller Earnings test suite"
say "════════════════════════════════════════════════"

# ── 0. Seed + clean slate (BEFORE server start) ────────────────
DATABASE_URL="file:$ROOT/db/custom.db" bunx tsx scripts/seed-phase3-gapfill.ts > "$LOGDIR/seed.log" 2>&1 \
  && pass "seed-phase3 users/orders ready" || fail "seed-phase3" "$(tail -2 "$LOGDIR/seed.log")"

ADMIN_ID="cmrar4fgy0000vcitwu695oe7"
SELLER_ID="cmsellerbiz000000000000001"

dbw "DELETE FROM SellerLedgerEntry;"
dbw "DELETE FROM RefundRequest;"
dbw "DELETE FROM OrderCancellationRequest;"
dbw "DELETE FROM AdminAuditLog;"
# test-hygiene: prior runs leave state that backfill/balance would re-pick-up
dbw "DELETE FROM SellerWithdrawal WHERE userId='$SELLER_ID';"
dbw "DELETE FROM PlatformSetting WHERE key='marketplace_commission_percent';"

OP1=$(dbq "SELECT id FROM MarketplaceOrder WHERE orderNumber='MD-P3-0001'")
OP2=$(dbq "SELECT id FROM MarketplaceOrder WHERE orderNumber='MD-P3-0002'")
OP3=$(dbq "SELECT id FROM MarketplaceOrder WHERE orderNumber='MD-P3-0003'")  # → processing + paid, ৳950
OP5=$(dbq "SELECT id FROM MarketplaceOrder WHERE orderNumber='MD-P3-0005'")  # → completed + paid, ৳950
[ -n "$OP3" ] && [ -n "$OP5" ] && pass "orders present" || fail "orders" "missing"

# The seed does NOT reset mutated order states — do it explicitly (like phase6).
dbw "UPDATE MarketplaceOrder SET status='pending_payment', paymentStatus='unpaid', cancelledAt=NULL, cancelledBy=NULL, cancelReason=NULL, refundedAt=NULL WHERE id='$OP1';"
dbw "UPDATE MarketplaceOrder SET status='queued', paymentStatus='paid', refundedAt=NULL, disputeReason=NULL, disputedAt=NULL WHERE id='$OP2';"
dbw "UPDATE MarketplaceOrder SET status='processing', paymentStatus='paid', refundedAt=NULL, disputeReason=NULL, disputedAt=NULL, createdAt=strftime('%s','now')*1000 WHERE id='$OP3';"
dbw "UPDATE MarketplaceOrder SET status='completed', paymentStatus='paid', refundedAt=NULL, disputeReason=NULL, disputedAt=NULL, createdAt=strftime('%s','now')*1000, completedAt=strftime('%s','now')*1000 WHERE id='$OP5';"

B3=$(dbq "SELECT userId FROM MarketplaceOrder WHERE id='$OP3'")
say "  buyer(OP3)=$B3 seller=$SELLER_ID"

ADMIN_COOKIE="Cookie: midman_session=$ADMIN_ID"
SELLER_COOKIE="Cookie: midman_session=$SELLER_ID"
B3_COOKIE="Cookie: midman_session=$B3"
ANON=()

# RBAC: make buyer3 a SUPPORT admin → must be denied finance APIs
dbw "INSERT OR IGNORE INTO Admin (id, userId, role, permissions, totpEnabled, createdAt, updatedAt) VALUES ('phase7-support-admin', '$B3', 'support', '[]', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);"
SUPPORT_COOKIE="Cookie: midman_session=$B3"

# ── 1. Backfill ────────────────────────────────────────────────
say ""
say "── ledger backfill ──"
DATABASE_URL="file:$ROOT/db/custom.db" bunx tsx scripts/phase7-ledger-backfill.ts > "$LOGDIR/backfill1.log" 2>&1 \
  && pass "backfill run 1 ok" || fail "backfill1" "$(tail -2 "$LOGDIR/backfill1.log")"
assert_eq "backfill writes 1 sale entry (OP5)" "1" "$(dbq "SELECT count(*) FROM SellerLedgerEntry WHERE type='sale'")"
assert_eq "sale entry amount = 950" "950.0" "$(dbq "SELECT amount FROM SellerLedgerEntry WHERE sourceId='$OP5' AND type='sale'")"
assert_eq "sale entry reference orderNumber" "MD-P3-0005" "$(dbq "SELECT orderNumber FROM MarketplaceOrder WHERE id=(SELECT sourceId FROM SellerLedgerEntry WHERE sourceId='$OP5' AND type='sale')")"
assert_eq "backfilled rate snapshot = 0" "0" "$(dbq "SELECT json_extract(details,'$.rate') FROM SellerLedgerEntry WHERE sourceId='$OP5' AND type='sale'")"

DATABASE_URL="file:$ROOT/db/custom.db" bunx tsx scripts/phase7-ledger-backfill.ts > "$LOGDIR/backfill2.log" 2>&1
assert_eq "backfill rerun idempotent (still 1)" "1" "$(dbq "SELECT count(*) FROM SellerLedgerEntry")"

# ── 2. Start dev server ────────────────────────────────────────
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

# ── 3. Commission config API ───────────────────────────────────
say ""
say "── commission configuration ──"
assert_eq "GET commission (default 0)" "0" "$(http_body "$BASE/api/admin/marketplace-commission" -H "$ADMIN_COOKIE" | jqval "d['percent']" 2>/dev/null || echo ERR)"
assert_eq "PUT commission 150 rejected" "400" "$(http_code -X PUT "$BASE/api/admin/marketplace-commission" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"percent":150}')"
assert_eq "PUT commission -5 rejected" "400" "$(http_code -X PUT "$BASE/api/admin/marketplace-commission" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"percent":-5}')"
assert_eq "PUT commission 10 accepted" "200" "$(http_code -X PUT "$BASE/api/admin/marketplace-commission" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"percent":10}')"
assert_eq "GET commission now 10" "10" "$(http_body "$BASE/api/admin/marketplace-commission" -H "$ADMIN_COOKIE" | jqval "d['percent']")"
assert_contains "commission change audited" "commission_rate_changed" "$(dbq "SELECT action FROM AdminAuditLog ORDER BY createdAt DESC LIMIT 1")"
assert_eq "support admin denied commission GET (403)" "403" "$(http_code "$BASE/api/admin/marketplace-commission" -H "$SUPPORT_COOKIE")"
assert_eq "anonymous denied commission (401)" "401" "$(http_code "$BASE/api/admin/marketplace-commission")"

# ── 3. Order completion → sale + commission ────────────────────
say ""
say "── order completion → ledger ──"
GROSS_BEFORE=$(http_body "$BASE/api/seller/analytics?range=30d" -H "$SELLER_COOKIE" | jqval "d['money']['grossSales']")
assert_eq "analytics baseline gross = 950 (backfilled OP5)" "950" "$GROSS_BEFORE"

code=$(http_code -X PATCH "$BASE/api/orders/$OP3/status" -H "$SELLER_COOKIE" -H 'Content-Type: application/json' -d '{"action":"complete"}')
assert_eq "seller completes processing+paid order" "200" "$code"

assert_eq "sale entry for OP3 (950)" "950.0" "$(dbq "SELECT amount FROM SellerLedgerEntry WHERE sourceId='$OP3' AND type='sale'")"
assert_eq "commission entry at snapshot 10% (−95)" "-95.0" "$(dbq "SELECT amount FROM SellerLedgerEntry WHERE sourceId='$OP3' AND type='commission'")"
assert_eq "sale details rate snapshot = 10" "10" "$(dbq "SELECT json_extract(details,'$.rate') FROM SellerLedgerEntry WHERE sourceId='$OP3' AND type='sale'")"

GROSS_AFTER=$(http_body "$BASE/api/seller/analytics?range=30d" -H "$SELLER_COOKIE" | jqval "d['money']['grossSales']")
assert_eq "analytics gross = 1900" "1900" "$GROSS_AFTER"
COMMISSION_NET=$(http_body "$BASE/api/seller/analytics?range=30d" -H "$SELLER_COOKIE" | jqval "d['money']['commission']")
assert_eq "analytics commission = 95" "95" "$COMMISSION_NET"
NET_MK=$(http_body "$BASE/api/seller/analytics?range=30d" -H "$SELLER_COOKIE" | jqval "d['money']['marketplaceNet']")
assert_eq "analytics marketplaceNet = 1805" "1805" "$NET_MK"

# re-complete is blocked by transition guard → ledger can't duplicate
code=$(http_code -X PATCH "$BASE/api/orders/$OP3/status" -H "$SELLER_COOKIE" -H 'Content-Type: application/json' -d '{"action":"complete"}')
assert_eq "re-complete blocked (409)" "409" "$code"
assert_eq "no duplicate sale entry" "1" "$(dbq "SELECT count(*) FROM SellerLedgerEntry WHERE sourceId='$OP3' AND type='sale'")"

# ── 4. Verified refund → refund + commission reversal ──────────
say ""
say "── verified refund → ledger ──"
code=$(http_code -X POST "$BASE/api/refunds" -H "$B3_COOKIE" -H 'Content-Type: application/json' -d "{\"orderId\":\"$OP3\",\"reason\":\"arrived damaged\",\"amount\":300}")
assert_eq "buyer submits refund request 300" "200" "$code"
RID=$(dbq "SELECT id FROM RefundRequest WHERE orderId='$OP3'")
[ -n "$RID" ] && pass "refund request row" || fail "refund request" "missing"
assert_eq "admin review→under_review" "200" "$(http_code -X PATCH "$BASE/api/admin/refunds/$RID" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"under_review"}')"
assert_eq "admin approve" "200" "$(http_code -X PATCH "$BASE/api/admin/refunds/$RID" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"approve"}')"
assert_eq "mark_refunded without reference blocked" "400" "$(http_code -X PATCH "$BASE/api/admin/refunds/$RID" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"mark_refunded"}')"
code=$(http_code -X PATCH "$BASE/api/admin/refunds/$RID" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"action":"mark_refunded","refundReference":"RF-TEST-777"}')
assert_eq "mark_refunded with reference" "200" "$code"

assert_eq "refund entry −300" "-300.0" "$(dbq "SELECT amount FROM SellerLedgerEntry WHERE sourceId='$OP3' AND type='refund'")"
assert_eq "commission reversal +30 (same 10% snapshot)" "30.0" "$(dbq "SELECT amount FROM SellerLedgerEntry WHERE sourceId='$OP3' AND type='commission_reversal'")"

MONEY=$(http_body "$BASE/api/seller/analytics?range=30d" -H "$SELLER_COOKIE")
assert_eq "analytics refunds = 300" "300" "$(echo "$MONEY" | jqval "d['money']['refunds']")"
assert_eq "analytics commission net = 65" "65" "$(echo "$MONEY" | jqval "d['money']['commission']")"
assert_eq "analytics marketplaceNet = 1535" "1535" "$(echo "$MONEY" | jqval "d['money']['marketplaceNet']")"
assert_eq "balance available = 1535" "1535" "$(echo "$MONEY" | jqval "d['balance']['available']")"

# ── 5. Payout workflow ─────────────────────────────────────────
say ""
say "── payout workflow (reference REQUIRED) ──"
code=$(http_code -X POST "$BASE/api/user/seller-withdrawals" -H "$SELLER_COOKIE" -H 'Content-Type: application/json' -d '{"amount":200,"accountType":"bkash","accountNumber":"01712345678","accountName":"Test Seller"}')
assert_eq "seller requests 200 withdrawal" "200" "$code"
WID=$(dbq "SELECT id FROM SellerWithdrawal WHERE userId='$SELLER_ID' AND status='pending' ORDER BY createdAt DESC LIMIT 1")
[ -n "$WID" ] && pass "withdrawal row created" || fail "withdrawal" "missing"
assert_eq "pending locked into balance" "1335" "$(http_body "$BASE/api/user/seller-withdrawals" -H "$SELLER_COOKIE" | jqval "d['balance']['available']")"

assert_eq "admin approve" "200" "$(http_code -X POST "$BASE/api/admin/seller-withdrawals/$WID/approve" -H "$ADMIN_COOKIE")"
assert_eq "complete WITHOUT reference blocked (400)" "400" "$(http_code -X POST "$BASE/api/admin/seller-withdrawals/$WID/complete" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{}')"
code=$(http_code -X POST "$BASE/api/admin/seller-withdrawals/$WID/complete" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"paymentReference":"BKASH-TXN-99881","paymentNote":"paid via bKash"}')
assert_eq "complete WITH reference accepted" "200" "$code"
assert_eq "payout ledger entry −200" "-200.0" "$(dbq "SELECT amount FROM SellerLedgerEntry WHERE sourceId='$WID' AND type='payout'")"
assert_eq "withdrawal completedAt + reference stored" "BKASH-TXN-99881" "$(dbq "SELECT paymentReference FROM SellerWithdrawal WHERE id='$WID'")"
assert_eq "duplicate complete blocked (409)" "409" "$(http_code -X POST "$BASE/api/admin/seller-withdrawals/$WID/complete" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d '{"paymentReference":"AGAIN-1"}')"
assert_eq "no duplicate payout entry" "1" "$(dbq "SELECT count(*) FROM SellerLedgerEntry WHERE sourceId='$WID' AND type='payout'")"
assert_eq "payout audited" "1" "$(dbq "SELECT count(*) FROM AdminAuditLog WHERE action='seller_payout_completed'")"
assert_eq "payout completion notification sent" "1" "$(dbq "SELECT count(*) FROM Notification WHERE userId='$SELLER_ID' AND type='seller_payout_completed'")"
assert_eq "available after payout = 1335" "1335" "$(http_body "$BASE/api/user/seller-withdrawals" -H "$SELLER_COOKIE" | jqval "d['balance']['available']")"

# ── 6. Admin adjustment ────────────────────────────────────────
say ""
say "── admin financial adjustment ──"
assert_eq "adjustment without reason blocked" "400" "$(http_code -X POST "$BASE/api/admin/seller-ledger/adjustment" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d "{\"sellerId\":\"$SELLER_ID\",\"amount\":100}")"
assert_eq "zero amount blocked" "400" "$(http_code -X POST "$BASE/api/admin/seller-ledger/adjustment" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d "{\"sellerId\":\"$SELLER_ID\",\"amount\":0,\"reason\":\"test\"}")"
code=$(http_code -X POST "$BASE/api/admin/seller-ledger/adjustment" -H "$ADMIN_COOKIE" -H 'Content-Type: application/json' -d "{\"sellerId\":\"$SELLER_ID\",\"amount\":100.5,\"reason\":\"promo bonus\"}")
assert_eq "adjustment +100.50 accepted" "200" "$code"
assert_eq "adjustment ledger entry" "100.5" "$(dbq "SELECT amount FROM SellerLedgerEntry WHERE type='adjustment' AND details LIKE '%promo bonus%'")"
assert_contains "adjustment audited" "ledger_adjustment_credit" "$(dbq "SELECT action FROM AdminAuditLog WHERE targetType='ledger' ORDER BY createdAt DESC LIMIT 1")"
assert_eq "adjustment notification sent" "1" "$(dbq "SELECT count(*) FROM Notification WHERE userId='$SELLER_ID' AND type='ledger_adjustment'")"
assert_eq "available after adjustment = 1435.5" "1435.5" "$(http_body "$BASE/api/user/seller-withdrawals" -H "$SELLER_COOKIE" | jqval "d['balance']['available']")"

# ── 7. RBAC ────────────────────────────────────────────────────
say ""
say "── RBAC ──"
assert_eq "seller analytics requires auth (401)" "401" "$(http_code "$BASE/api/seller/analytics?range=30d")"
assert_eq "non-seller blocked from analytics (403)" "403" "$(http_code "$BASE/api/seller/analytics?range=30d" -H "$B3_COOKIE")"
assert_eq "non-seller blocked from ledger (403)" "403" "$(http_code "$BASE/api/seller/ledger" -H "$B3_COOKIE")"
assert_eq "support admin denied seller-financials (403)" "403" "$(http_code "$BASE/api/admin/seller-financials" -H "$SUPPORT_COOKIE")"
assert_eq "seller ledger scoped to own data" "7" "$(dbq "SELECT count(*) FROM SellerLedgerEntry WHERE sellerId='$SELLER_ID'")"

# ── 8. Ledger API + filters ────────────────────────────────────
say ""
say "── ledger API ──"
LEDGER=$(http_body "$BASE/api/seller/ledger" -H "$SELLER_COOKIE")
assert_eq "ledger total = 7" "7" "$(echo "$LEDGER" | jqval "d['total']")"
assert_contains "ledger resolves orderNumber reference" "MD-P3-0003" "$(echo "$LEDGER" | head -c 2000)"
SALES_ONLY=$(http_body "$BASE/api/seller/ledger?type=sale" -H "$SELLER_COOKIE")
assert_eq "type filter: sales only" "2" "$(echo "$SALES_ONLY" | jqval "d['total']")"
LEDGER_ADMIN=$(http_body "$BASE/api/admin/seller-financials?sellerId=$SELLER_ID" -H "$ADMIN_COOKIE")
assert_eq "admin per-seller report marketplaceNet = 1535" "1535" "$(echo "$LEDGER_ADMIN" | jqval "d['money']['marketplaceNet']")"
assert_eq "admin per-seller dealEarnings = 0 (distinguishable)" "0" "$(echo "$LEDGER_ADMIN" | jqval "d['money']['dealEarnings']")"
FIN_LIST=$(http_body "$BASE/api/admin/seller-financials" -H "$ADMIN_COOKIE")
assert_contains "seller list contains our seller" "$SELLER_ID" "$FIN_LIST"

# ── 9. Analytics ranges + product aggregation ──────────────────
say ""
say "── analytics ranges & product aggregation ──"
W=$(http_body "$BASE/api/seller/analytics?range=custom&from=2026-01-01&to=2026-12-31" -H "$SELLER_COOKIE")
assert_eq "custom window works" "custom" "$(echo "$W" | jqval "d['range']['preset']")"
assert_eq "custom 30d+ window bucket = month" "month" "$(echo "$W" | jqval "d['range']['unit']")"
assert_eq "custom window gross = 1900 (OP3+OP5)" "1900" "$(echo "$W" | jqval "d['money']['grossSales']")"
PRODUCTS=$(http_body "$BASE/api/seller/analytics?range=custom&from=2026-01-01&to=2026-12-31" -H "$SELLER_COOKIE")
assert_contains "product-wise aggregation lists product" "productId" "$PRODUCTS"
# OP3 was refunded by the refund test above → completed=1 (OP5), refunded=1 (OP3)
assert_eq "order KPIs completed = 1" "1" "$(echo "$PRODUCTS" | jqval "d['orders']['completed']")"
assert_eq "order KPIs refunded = 1" "1" "$(echo "$PRODUCTS" | jqval "d['orders']['refunded']")"

# invalid custom range rejected
assert_eq "invalid custom range rejected (400)" "400" "$(http_code "$BASE/api/seller/analytics?range=custom&from=bad&to=worse" -H "$SELLER_COOKIE")"

say ""
say "════════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  say " PASS: $PASS   FAIL: $FAIL"
else
  say " PASS: $PASS   FAIL: $FAIL"
  say " failed: ${FAILED_NAMES[*]}"
fi
say "════════════════════════════════════════════════"
exit $FAIL
