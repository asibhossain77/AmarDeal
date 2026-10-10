#!/usr/bin/env bash
# Browser verification part 3 — customer dashboard via session cookie.
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
DATABASE_URL="file:$ROOT/db/custom.db" NEXT_PUBLIC_APP_URL="$BASE" bunx next dev -p $PORT > "$LOG/dev3.log" 2>&1 &
DEV_PID=$!
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null --max-time 5 -w '%{http_code}' "$BASE/api/health" || true)
  [ "$code" == "200" ] && break
  sleep 1
done
echo "health: $code"

USER_ID=$(python3 -c "
import sqlite3
con = sqlite3.connect('db/custom.db')
row = con.execute(\"SELECT id FROM User WHERE email='user@demo.com'\").fetchone()
print(row[0] if row else '')")
echo "user id: $USER_ID"

agent-browser open "$BASE/" >/dev/null 2>&1
agent-browser wait 2000 >/dev/null 2>&1
agent-browser cookies set midman_session "$USER_ID" >/dev/null 2>&1

echo "── [B7] My Orders panel ──"
agent-browser open "$BASE/dashboard/my-orders" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 4500 >/dev/null 2>&1
agent-browser get url
S3=$(agent-browser snapshot -c 2>&1)
agent-browser screenshot "$LOG/7-my-orders.png" >/dev/null 2>&1
if echo "$S3" | rg -q "আমার অর্ডার|My Orders"; then echo "✓ My Orders panel rendered"; else echo "✗ My Orders panel missing"; fi
if echo "$S3" | rg -q "MP-[A-Z0-9]{6}"; then echo "✓ order rows with MP numbers"; else echo "✗ no order rows"; fi
if echo "$S3" | rg -q "Facebook Page Likes"; then echo "✓ service names visible"; else echo "✗ service names missing"; fi
# sidebar contains the My Orders nav item
if echo "$S3" | rg -q "আমার অর্ডার"; then echo "✓ sidebar nav item present"; fi
echo "$S3" | rg "MP-" | head -5

ORD_ID=$(python3 -c "
import sqlite3
con = sqlite3.connect('db/custom.db')
row = con.execute(\"SELECT id FROM MarketplaceOrder WHERE userId='$USER_ID' AND status IN ('completed','queued') ORDER BY createdAt DESC LIMIT 1\").fetchone()
print(row[0] if row else '')")
echo "order id (paid): $ORD_ID"

echo "── [B8] order detail + timeline ──"
agent-browser open "$BASE/dashboard/orders/$ORD_ID" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 4500 >/dev/null 2>&1
agent-browser screenshot "$LOG/8-order-detail.png" >/dev/null 2>&1
S4=$(agent-browser snapshot -c 2>&1)
if echo "$S4" | rg -q "স্ট্যাটাস টাইমলাইন|Status timeline"; then echo "✓ timeline rendered"; else echo "✗ timeline missing"; fi
if echo "$S4" | rg -q "পেমেন্ট তথ্য|Payment information"; then echo "✓ payment info section"; else echo "✗ payment info missing"; fi
if echo "$S4" | rg -q "ভেরিফাইড|verified"; then echo "✓ payment_verified event shown"; else echo "✗ no verified event"; fi
if echo "$S4" | rg -q "facebook.com"; then echo "✓ target link shown"; else echo "✗ target link missing"; fi
echo "── console errors ──"
agent-browser errors 2>&1 | head -6
echo "── done ──"
