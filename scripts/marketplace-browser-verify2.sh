#!/usr/bin/env bash
# Browser verification part 2 — login, customer dashboard, admin panel.
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
DATABASE_URL="file:$ROOT/db/custom.db" NEXT_PUBLIC_APP_URL="$BASE" bunx next dev -p $PORT > "$LOG/dev2.log" 2>&1 &
DEV_PID=$!
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null --max-time 5 -w '%{http_code}' "$BASE/api/health" || true)
  [ "$code" == "200" ] && break
  sleep 1
done
echo "health: $code"

echo "── [B1b] verify marketplace tabs (bn labels) ──"
agent-browser open "$BASE/marketplace" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 4000 >/dev/null 2>&1
S=$(agent-browser snapshot -c 2>&1)
if echo "$S" | rg -q "এসএমএম সার্ভিস"; then echo "✓ SMM tab (bn) present"; else echo "✗ SMM tab missing"; fi
if echo "$S" | rg -q "ডিজিটাল প্রোডাক্ট"; then echo "✓ Digital Products tab (bn) present"; else echo "✗ products tab missing"; fi

echo "── [B5] login via UI ──"
agent-browser open "$BASE/login" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 2500 >/dev/null 2>&1
# Click "email login" to reveal the form
agent-browser find text "ইমেইল দিয়ে লগইন" click >/dev/null 2>&1 || agent-browser find text "Login with Email" click >/dev/null 2>&1
agent-browser wait 1500 >/dev/null 2>&1
SI=$(agent-browser snapshot -i -c 2>&1)
echo "$SI" | rg "textbox|@e" | head -12
EMAIL_BOX=$(echo "$SI" | rg -o 'textbox "[^"]*".*\[ref=(e[0-9]+)\]' | head -1 | rg -o 'ref=(e[0-9]+)' | rg -o 'e[0-9]+')
PASS_BOX=$(echo "$SI" | rg -o 'textbox "[^"]*".*\[ref=(e[0-9]+)\]' | sed -n '2p' | rg -o 'ref=(e[0-9]+)' | rg -o 'e[0-9]+')
echo "email box: @$EMAIL_BOX  pass box: @$PASS_BOX"
agent-browser fill "@$EMAIL_BOX" "user@demo.com" >/dev/null 2>&1
agent-browser fill "@$PASS_BOX" "test1234" >/dev/null 2>&1
agent-browser screenshot "$LOG/3-login-filled.png" >/dev/null 2>&1
# submit — find the login/submit button after fields appeared
SI2=$(agent-browser snapshot -i -c 2>&1)
LOGIN_BTN=$(echo "$SI2" | rg -o 'button "[^"]*(লগইন|Login)[^"]*".*\[ref=(e[0-9]+)\]' | rg -o 'ref=(e[0-9]+)' | rg -o 'e[0-9]+' | tail -1)
echo "login btn: @$LOGIN_BTN"
agent-browser click "@$LOGIN_BTN" >/dev/null 2>&1
agent-browser wait 4000 >/dev/null 2>&1
agent-browser get url
# After fresh login the app goes to landing; open dashboard directly
agent-browser open "$BASE/dashboard/my-orders" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 4000 >/dev/null 2>&1
agent-browser get url
S3=$(agent-browser snapshot -c 2>&1)
agent-browser screenshot "$LOG/4-my-orders.png" >/dev/null 2>&1
if echo "$S3" | rg -q "আমার অর্ডার|My Orders"; then echo "✓ My Orders panel rendered"; else echo "✗ My Orders panel missing"; fi
if echo "$S3" | rg -q "MP-[A-Z0-9]{6}"; then echo "✓ order rows visible with MP numbers"; else echo "✗ no order rows"; fi
if echo "$S3" | rg -q "Facebook Page Likes"; then echo "✓ order service names visible"; else echo "✗ service names missing"; fi
# open first order detail
ORD_ID=$(python3 -c "
import sqlite3
con = sqlite3.connect('db/custom.db')
row = con.execute(\"SELECT id FROM MarketplaceOrder WHERE userId=(SELECT id FROM User WHERE email='user@demo.com') ORDER BY createdAt DESC LIMIT 1\").fetchone()
print(row[0] if row else '')")
echo "order id: $ORD_ID"
agent-browser open "$BASE/dashboard/orders/$ORD_ID" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 4000 >/dev/null 2>&1
agent-browser screenshot "$LOG/5-order-detail.png" >/dev/null 2>&1
S4=$(agent-browser snapshot -c 2>&1)
if echo "$S4" | rg -q "স্ট্যাটাস টাইমলাইন|Status timeline"; then echo "✓ order timeline rendered"; else echo "✗ timeline missing"; fi
if echo "$S4" | rg -q "পেমেন্ট তথ্য|Payment information"; then echo "✓ payment info rendered"; else echo "✗ payment info missing"; fi

echo "── [B6] admin panel (services) ──"
# logout customer, login admin — set admin password via DB for UI login is not
# needed: admin cookie can be set directly (session cookie = user id).
ADMIN_ID=$(python3 -c "
import sqlite3
con = sqlite3.connect('db/custom.db')
row = con.execute(\"SELECT userId FROM Admin LIMIT 1\").fetchone()
print(row[0] if row else '')")
agent-browser cookies set midman_session "$ADMIN_ID" >/dev/null 2>&1
agent-browser open "$BASE/admin/services" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 4500 >/dev/null 2>&1
agent-browser screenshot "$LOG/6-admin-services.png" >/dev/null 2>&1
S5=$(agent-browser snapshot -c 2>&1)
if echo "$S5" | rg -q "এসএমএম সার্ভিস ম্যানেজমেন্ট|SMM Service Management"; then echo "✓ admin services panel rendered"; else echo "✗ admin panel missing"; fi
if echo "$S5" | rg -q "Facebook Page Likes"; then echo "✓ admin service list populated"; else echo "✗ admin list empty"; fi
if echo "$S5" | rg -q "অর্ডার|Orders"; then echo "✓ orders tab present"; else echo "✗ orders tab missing"; fi
agent-browser errors 2>&1 | head -5

echo "── browser verification done ──"
