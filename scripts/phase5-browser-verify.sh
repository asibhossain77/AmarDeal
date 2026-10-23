#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Phase 5 — Browser verification (agent-browser).
# Starts the dev server, verifies the tracker UI renders for the
# buyer, the seller orders page shows delivery actions, and the
# marketplace still renders. Single invocation; tears down on exit.
# ═══════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
PORT=3211
BASE="http://127.0.0.1:$PORT"
BUYER_ID="cmbuyer0000000000000000001"
SELLER_ID="cmsellerbiz000000000000001"

PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1  $2"; }

cleanup() { [ -n "${DEV_PID:-}" ] && kill "$DEV_PID" 2>/dev/null; agent-browser close >/dev/null 2>&1; wait 2>/dev/null; }
trap cleanup EXIT

# Pick a completed PHYSICAL test order (has courier + tracking + full history)
OID=$(python3 -c "
import sqlite3
con = sqlite3.connect('db/custom.db')
row = con.execute(\"\"\"SELECT o.id FROM MarketplaceOrder o JOIN DigitalProduct p ON p.id=o.productId
WHERE p.itemType='physical' AND o.status='completed' AND o.trackingNumber IS NOT NULL
ORDER BY o.createdAt DESC LIMIT 1\"\"\").fetchone()
print(row[0] if row else '')
")
[ -n "$OID" ] && echo "  test order: $OID" || { echo "  ✗ no completed physical order found"; exit 1; }

echo "── starting dev server on :$PORT ──"
DATABASE_URL="file:$ROOT/db/custom.db" NEXT_PUBLIC_APP_URL="$BASE" bunx next dev -p $PORT > /tmp/phase5-browser-dev.log 2>&1 &
DEV_PID=$!
code="000"
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null --max-time 5 -w '%{http_code}' "$BASE/api/health" || true)
  [ "$code" != "000" ] && break
  sleep 1
done
echo "  server: $code"

# Warm the heavy SPA route
curl -s -o /dev/null --max-time 120 "$BASE/marketplace"

echo "── [V1] marketplace renders ──"
agent-browser set viewport 1280 900 >/dev/null
agent-browser open "$BASE/marketplace" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 1500 >/dev/null 2>&1
TITLE=$(agent-browser get title 2>/dev/null)
ERRS=$(agent-browser errors 2>/dev/null | head -5)
if agent-browser eval "document.querySelector('main') !== null" 2>/dev/null | rg -q "true"; then pass "V1 marketplace main renders"; else fail "V1 marketplace main" "$ERRS"; fi
if echo "$ERRS" | rg -qi "hydration|error boundary"; then fail "V1.1 no hydration errors" "$ERRS"; else pass "V1.1 no hydration errors"; fi
agent-browser screenshot /tmp/phase5-marketplace.png >/dev/null 2>&1

echo "── [V2] buyer order detail — tracker + shipping ──"
agent-browser open "$BASE/dashboard" >/dev/null 2>&1
agent-browser wait 800 >/dev/null 2>&1
agent-browser cookies set midman_session "$BUYER_ID" >/dev/null 2>&1
agent-browser open "$BASE/dashboard/orders/$OID" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 2500 >/dev/null 2>&1
BODY=$(agent-browser get text "body" 2>/dev/null)
echo "$BODY" | rg -q "অর্ডার অগ্রগতি" && pass "V2 tracker title renders" || fail "V2 tracker title" "$(echo "$BODY" | head -c 120)"
echo "$BODY" | rg -q "কনফার্ম হয়েছে" && pass "V2.1 confirmed step label" || fail "V2.1 confirmed step" "missing"
echo "$BODY" | rg -q "ডেলিভারির পথে" && pass "V2.2 out-for-delivery step label" || fail "V2.2 out-for-delivery step" "missing"
echo "$BODY" | rg -q "শিপিং ও ট্র্যাকিং" && pass "V2.3 shipping card" || fail "V2.3 shipping card" "missing"
echo "$BODY" | rg -q "Sundarban" && pass "V2.4 courier name visible" || fail "V2.4 courier name" "missing"
echo "$BODY" | rg -q "SB888777" && pass "V2.5 tracking number visible" || fail "V2.5 tracking number" "missing"
echo "$BODY" | rg -q "ডেলিভারি ঠিকানা" && pass "V2.6 delivery address card" || fail "V2.6 delivery address card" "missing"
echo "$BODY" | rg -q "স্ট্যাটাস টাইমলাইন" && pass "V2.7 event timeline present" || fail "V2.7 event timeline" "missing"
agent-browser screenshot /tmp/phase5-buyer-order.png >/dev/null 2>&1

echo "── [V3] mobile viewport check (buyer order detail) ──"
agent-browser set viewport 390 844 >/dev/null
agent-browser wait 600 >/dev/null 2>&1
agent-browser screenshot /tmp/phase5-buyer-order-mobile.png >/dev/null 2>&1
if agent-browser eval "document.body.scrollWidth <= window.innerWidth + 2" 2>/dev/null | rg -q "true"; then pass "V3 no horizontal overflow on mobile"; else fail "V3 mobile overflow" "scrollWidth > innerWidth"; fi
agent-browser set viewport 1280 900 >/dev/null

echo "── [V4] seller orders page — new statuses + details ──"
agent-browser open "$BASE/dashboard" >/dev/null 2>&1
agent-browser cookies set midman_session "$SELLER_ID" >/dev/null 2>&1
agent-browser open "$BASE/dashboard/seller-marketplace-orders" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 2500 >/dev/null 2>&1
BODY=$(agent-browser get text "body" 2>/dev/null)
echo "$BODY" | rg -q "MP-" && pass "V4 seller sees orders" || fail "V4 seller orders list" "$(echo "$BODY" | head -c 120)"
# open the details dialog of the completed order
# (snapshot shows refs as "ref=eNN" — click syntax needs "@eNN")
# Filter to the tracked order first so the first row IS that order
ORDER_NO=$(python3 -c "
import sqlite3
con = sqlite3.connect('db/custom.db')
row = con.execute(\"SELECT orderNumber FROM MarketplaceOrder WHERE id='$OID'\").fetchone()
print(row[0] if row else '')
")
SEARCHREF=$(agent-browser snapshot -i 2>/dev/null | rg 'textbox "অর্ডার নম্বর|textbox "Order number' | rg -o 'ref=e[0-9]+' | head -1 | sed 's/ref=e/@e/')
if [ -n "$SEARCHREF" ]; then
  agent-browser fill "$SEARCHREF" "$ORDER_NO" >/dev/null 2>&1
  agent-browser wait 1200 >/dev/null 2>&1
fi
VIEWREF=$(agent-browser snapshot -i 2>/dev/null | rg 'button "বিস্তারিত দেখুন"|button "View Details"' | rg -o 'ref=e[0-9]+' | head -1 | sed 's/ref=e/@e/')
if [ -n "$VIEWREF" ]; then
  agent-browser click "$VIEWREF" >/dev/null 2>&1
  agent-browser wait 2000 >/dev/null 2>&1
  BODY=$(agent-browser get text "body" 2>/dev/null)
  echo "$BODY" | rg -q "অর্ডার অগ্রগতি" && pass "V4.1 dialog shows tracker" || fail "V4.1 dialog tracker" "missing"
  echo "$BODY" | rg -q "শিপিং ও ট্র্যাকিং" && pass "V4.2 dialog shows shipping info" || fail "V4.2 dialog shipping" "missing"
  echo "$BODY" | rg -q "ডেলিভারি হিসেবে চিহ্নিত করুন|ডেলিভারির পথে" && pass "V4.3 delivery action vocabulary" || fail "V4.3 delivery actions" "missing"
  agent-browser screenshot /tmp/phase5-seller-dialog.png >/dev/null 2>&1
else
  fail "V4.1 view-details button" "not found"
fi

echo ""
echo "════════════════════════════════════════════════"
echo " BROWSER RESULTS: $PASS passed, $FAIL failed"
echo "════════════════════════════════════════════════"
[ "$FAIL" -eq 0 ]
