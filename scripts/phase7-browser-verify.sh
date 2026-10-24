#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Phase 7 — Browser verification (agent-browser).
# Verifies: seller analytics panel renders (cards, charts, ledger,
# payouts), sidebar nav item present, admin commission + financials
# panels render, marketplace still renders. Tears down on exit.
# ═══════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
PORT=3211
BASE="http://127.0.0.1:$PORT"
SELLER_ID="cmsellerbiz000000000000001"
ADMIN_ID="cmrar4fgy0000vcitwu695oe7"

PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1  $2"; }
check_text() {
  local url="$1" cookie="$2" needle="$3" label="$4"
  local attempt body
  for attempt in 1 2; do
    agent-browser open "$url" >/dev/null 2>&1
    agent-browser storage local clear >/dev/null 2>&1
    agent-browser cookies set midman_session "$cookie" >/dev/null 2>&1
    agent-browser reload >/dev/null 2>&1
    agent-browser wait --load networkidle >/dev/null 2>&1
    agent-browser wait 5000 >/dev/null 2>&1
    body=$(agent-browser eval "document.body.innerText" 2>/dev/null)
    if echo "$body" | rg -q -- "$needle"; then pass "$label"; return 0; fi
    # first attempt may hit a cold dev-compile — retry once
    agent-browser reload >/dev/null 2>&1
    agent-browser wait --load networkidle >/dev/null 2>&1
    agent-browser wait 5000 >/dev/null 2>&1
    body=$(agent-browser eval "document.body.innerText" 2>/dev/null)
    if echo "$body" | rg -q -- "$needle"; then pass "$label (retry)"; return 0; fi
  done
  fail "$label" "(missing '$needle')"
}

cleanup() { [ -n "${DEV_PID:-}" ] && kill "$DEV_PID" 2>/dev/null; agent-browser close >/dev/null 2>&1; wait 2>/dev/null; }
trap cleanup EXIT

say() { printf '%s\n' "$*"; }

say "── starting dev server on :$PORT ──"
DATABASE_URL="file:$ROOT/db/custom.db" NEXT_PUBLIC_APP_URL="$BASE" bunx next dev -p $PORT > /tmp/phase7-browser.log 2>&1 &
DEV_PID=$!
code="000"
for i in $(seq 1 120); do
  code=$(curl -s -o /dev/null --max-time 5 -w '%{http_code}' "$BASE/api/health" || true)
  [ "$code" == "200" ] && break
  sleep 1
done
[ "$code" == "200" ] && pass "dev server ready" || fail "dev server" "health=$code"

agent-browser set viewport 1440 900 >/dev/null 2>&1

say ""
say "── seller analytics panel ──"
check_text "$BASE/dashboard/seller-analytics" "$SELLER_ID" "বিক্রয় ও আয়" "analytics panel title renders"
check_text "$BASE/dashboard/seller-analytics" "$SELLER_ID" "মোট অর্ডার" "order KPI cards render"
check_text "$BASE/dashboard/seller-analytics" "$SELLER_ID" "মোট বিক্রয়" "money cards render"
check_text "$BASE/dashboard/seller-analytics" "$SELLER_ID" "আর্থিক লেজার" "ledger section renders"
check_text "$BASE/dashboard/seller-analytics" "$SELLER_ID" "উত্তোলনযোগ্য ব্যালেন্স" "payout balance renders"

# charts actually draw (recharts svg present)
agent-browser cookies clear >/dev/null 2>&1
agent-browser cookies set midman_session "$SELLER_ID" >/dev/null 2>&1
agent-browser open "$BASE/dashboard/seller-analytics" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 3000 >/dev/null 2>&1
svg=$(agent-browser eval "document.querySelectorAll('.recharts-surface').length" 2>/dev/null | tail -1)
if [ "${svg:-0}" -ge 1 ] 2>/dev/null; then pass "charts render (recharts svg x$svg)"; else fail "charts render" "svg count=$svg"; fi
ledger_rows=$(agent-browser eval "document.querySelectorAll('table tbody tr').length" 2>/dev/null | tail -1)
if [ "${ledger_rows:-0}" -ge 1 ] 2>/dev/null; then pass "ledger rows visible ($ledger_rows)"; else fail "ledger rows" "count=$ledger_rows"; fi
agent-browser screenshot /tmp/phase7-seller-analytics.png >/dev/null 2>&1
[ -f /tmp/phase7-seller-analytics.png ] && pass "screenshot saved"

say ""
say "── seller sidebar nav ──"
sidebar_ok=0
for attempt in 1 2 3; do
  agent-browser open "$BASE/dashboard" >/dev/null 2>&1
  agent-browser storage local clear >/dev/null 2>&1
  agent-browser cookies set midman_session "$SELLER_ID" >/dev/null 2>&1
  agent-browser reload >/dev/null 2>&1
  agent-browser wait --load networkidle >/dev/null 2>&1
  agent-browser wait 5000 >/dev/null 2>&1
  nav=$(agent-browser eval "document.body.innerText" 2>/dev/null)
  if echo "$nav" | rg -q "বিক্রয় ও আয়"; then sidebar_ok=1; break; fi
done
[ "$sidebar_ok" == "1" ] && pass "sidebar shows বিক্রয় ও আয়" || fail "sidebar nav item" "missing"
agent-browser eval "(() => { const el = [...document.querySelectorAll('button, a, [role=button]')].find(x => x.textContent.includes('বিক্রয় ও আয়')); if (el) { el.click(); return 'clicked' } return 'not-found' })()" >/dev/null 2>&1
agent-browser wait 3000 >/dev/null 2>&1
after=$(agent-browser eval "document.body.innerText" 2>/dev/null)
echo "$after" | rg -q "আর্থিক লেজার" && pass "sidebar click opens analytics panel" || fail "sidebar click" "panel did not open"

say ""
say "── admin panels ──"
check_text "$BASE/admin/marketplace-commission" "$ADMIN_ID" "মার্কেটপ্লেস কমিশন হার" "commission panel renders"
check_text "$BASE/admin/seller-financials" "$ADMIN_ID" "সেলার আর্থিক রিপোর্ট" "financials panel renders"
check_text "$BASE/admin/seller-financials" "$ADMIN_ID" "রাকিব এন্টারপ্রাইজ" "financials lists seller"

say ""
say "── regression: marketplace + seller orders ──"
check_text "$BASE/marketplace" "$SELLER_ID" "মার্কেটপ্লেস" "marketplace renders"
check_text "$BASE/dashboard/seller-marketplace-orders" "$SELLER_ID" "অর্ডার" "seller orders panel still works"
check_text "$BASE/dashboard/seller-withdraw" "$SELLER_ID" "উত্তোলন" "withdraw panel still works"

say ""
say "════════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  say " BROWSER PASS: $PASS   FAIL: $FAIL"
else
  say " BROWSER PASS: $PASS   FAIL: $FAIL"
fi
say "════════════════════════════════════════════════"
exit $FAIL
