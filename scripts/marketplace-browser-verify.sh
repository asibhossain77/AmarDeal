#!/usr/bin/env bash
# Browser (agent-browser) verification of the Marketplace Direct Order
# golden path. Starts the dev server, drives the SPA, takes screenshots,
# then tears down. Run: bash scripts/marketplace-browser-verify.sh
set -u
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
PORT=3210
BASE="http://127.0.0.1:$PORT"
LOG=/tmp/mp-browser
mkdir -p "$LOG"

cleanup() {
  [ -n "${DEV_PID:-}" ] && kill "$DEV_PID" 2>/dev/null
  agent-browser close >/dev/null 2>&1
  wait 2>/dev/null
}
trap cleanup EXIT

echo "── starting dev server ──"
DATABASE_URL="file:$ROOT/db/custom.db" NEXT_PUBLIC_APP_URL="$BASE" bunx next dev -p $PORT > "$LOG/dev.log" 2>&1 &
DEV_PID=$!
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null --max-time 5 -w '%{http_code}' "$BASE/api/health" || true)
  [ "$code" == "200" ] && break
  sleep 1
done
echo "health: $code"

echo "── [B1] marketplace page (SMM tab) ──"
agent-browser open "$BASE/marketplace" || exit 1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 4000 >/dev/null 2>&1
agent-browser snapshot -i -c 2>&1 | head -40 > "$LOG/snap1.txt"
echo "title: $(agent-browser get title)"
agent-browser screenshot "$LOG/1-marketplace.png" >/dev/null 2>&1
# Check for the SMM services storefront content
if agent-browser snapshot -c 2>&1 | rg -q "Facebook Page Likes"; then echo "✓ SMM service card visible"; else echo "✗ SMM service card NOT visible"; fi
if agent-browser snapshot -c 2>&1 | rg -q "SMM Services"; then echo "✓ SMM tab present"; else echo "✗ SMM tab missing"; fi
if agent-browser snapshot -c 2>&1 | rg -qi "Digital Products"; then echo "✓ Digital Products tab present"; else echo "✗ products tab missing"; fi

echo "── [B2] open service detail ──"
SVC_ID=$(python3 -c "
import sqlite3
con = sqlite3.connect('db/custom.db')
row = con.execute(\"SELECT id FROM MarketplaceService WHERE status='published' AND isActive=1 AND name='Facebook Page Likes' ORDER BY createdAt DESC LIMIT 1\").fetchone()
print(row[0] if row else '')")
echo "service id: $SVC_ID"
agent-browser open "$BASE/service/$SVC_ID" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 3500 >/dev/null 2>&1
agent-browser screenshot "$LOG/2-service.png" >/dev/null 2>&1
S=$(agent-browser snapshot -c 2>&1)
echo "$S" | head -30 > "$LOG/snap2.txt"
if echo "$S" | rg -q "Facebook Page Likes"; then echo "✓ service name rendered"; else echo "✗ service name missing"; fi
if echo "$S" | rg -q "Target link|টার্গেট লিংক"; then echo "✓ order form (target link) rendered"; else echo "✗ order form missing"; fi
if echo "$S" | rg -q "Place Order|অর্ডার করুন"; then echo "✓ place-order button rendered"; else echo "✗ button missing"; fi
if echo "$S" | rg -q "350|৳"; then echo "✓ price visible"; else echo "✗ price missing"; fi

echo "── [B3] SEO page check (server-rendered metadata) ──"
curl -s "$BASE/service/$SVC_ID" | rg -o '<title>[^<]*</title>' | head -1
curl -s "$BASE/service/$SVC_ID" | rg -c 'application/ld\+json' && echo "✓ JSON-LD present"

echo "── [B4] login as customer ──"
agent-browser open "$BASE/login" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 2500 >/dev/null 2>&1
SI=$(agent-browser snapshot -i -c 2>&1)
echo "$SI" | head -20
EMAIL_REF=$(echo "$SI" | rg -o '@e[0-9]+[^ ]*' | head -1 | tr -d '@' )
echo "refs: $SI" | head -5
