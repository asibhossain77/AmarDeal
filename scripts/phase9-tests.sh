#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Phase 9 E2E — Admin Marketplace Control & Seller Moderation
# Base URL from $1 (default http://localhost:3100)
# ═══════════════════════════════════════════════════════════════
set -u
BASE="${1:-http://localhost:3100}"

# ── Throttle: the proxy's api-general limiter allows 60 req/min per IP.
# The suite makes ~70 calls — pace them below the cap (1.1s ≈ 54/min).
REAL_CURL="$(command -v curl)"
curl() {
  "$REAL_CURL" "$@"
  local rc=$?
  sleep 1.1
  return $rc
}

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
check() { # $1 desc, $2 expected, $3 actual
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (expected $2, got $3)"; fi
}
contains() { # $1 desc, $2 needle, $3 haystack
  if echo "$3" | grep -q "$2"; then ok "$1"; else bad "$1 (missing: $2)"; fi
}
not_contains() {
  if echo "$3" | grep -q "$2"; then bad "$1 (unexpectedly contains: $2)"; else ok "$1"; fi
}

echo "── Reading seed ids ──"
SEED_JSON=$(cat /home/z/my-project/phase9-seed.json)
ADMIN_ID=$(echo "$SEED_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['superAdmin']['id'])")
STAFF_ID=$(echo "$SEED_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['staff']['id'])")
SNP_ID=$(echo "$SEED_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['staffNoPerms']['id'])")
SUPPORT_ID=$(echo "$SEED_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['support']['id'])")
SELLER_A=$(echo "$SEED_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['sellerA']['id'])")
SELLER_B=$(echo "$SEED_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['sellerB']['id'])")
SELLER_C=$(echo "$SEED_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['sellerC']['id'])")
BUYER_ID=$(echo "$SEED_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['buyer']['id'])")
PROD_A_ACTIVE=$(echo "$SEED_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['products']['prodAActive'])")
PROD_A_PENDING=$(echo "$SEED_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['products']['prodAPending'])")
PROD_B_ACTIVE=$(echo "$SEED_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['products']['prodBActive'])")
PROD_C_ACTIVE=$(echo "$SEED_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['products']['prodCActive'])")

# Direct session cookies (cookie value = user id — same mechanism the app uses)
COOKIE_ADMIN="Cookie: midman_session=$ADMIN_ID"
COOKIE_STAFF="Cookie: midman_session=$STAFF_ID"
COOKIE_SNP="Cookie: midman_session=$SNP_ID"
COOKIE_SUPPORT="Cookie: midman_session=$SUPPORT_ID"
COOKIE_SELLER_A="Cookie: midman_session=$SELLER_A"
COOKIE_SELLER_C="Cookie: midman_session=$SELLER_C"

echo "── 1. Auth guards ──"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/admin/marketplace-sellers")
check "anonymous marketplace-sellers → 401" 401 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/admin/marketplace-products")
check "anonymous marketplace-products → 401" 401 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/admin/moderation-reports")
check "anonymous moderation-reports → 401" 401 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/admin/marketplace-monitor")
check "anonymous marketplace-monitor → 401" 401 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -H "$COOKIE_SELLER_A" "$BASE/api/admin/marketplace-sellers")
check "seller (non-admin) → 403" 403 "$code"

echo "── 2. Real login works (unchanged) ──"
LOGIN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"identifier":"p9-admin@midman.test","password":"phase9pass"}')
contains "admin login ok" '"success":true\|"isAdmin":true' "$LOGIN"

echo "── 3. Sellers list ──"
LIST=$(curl -s -H "$COOKIE_ADMIN" "$BASE/api/admin/marketplace-sellers")
contains "list has stats" '"totalSellers"' "$LIST"
not_contains "list NEVER leaks documentImage" '"documentImage"' "$LIST"
code=$(curl -s -o /dev/null -w '%{http_code}' -H "$COOKIE_SUPPORT" "$BASE/api/admin/marketplace-sellers")
check "support CAN view sellers list" 200 "$code"
FILTERED=$(curl -s -H "$COOKIE_ADMIN" "$BASE/api/admin/marketplace-sellers?status=active&role=business&sort=name")
contains "role=business filter works" 'C Enterprise' "$FILTERED"

echo "── 4. Seller detail (document privacy) ──"
DETAIL=$(curl -s -H "$COOKIE_ADMIN" "$BASE/api/admin/marketplace-sellers/$SELLER_C")
contains "detail has pending application" '"applicationType":"business"' "$DETAIL"
contains "application exposes hasDocument" '"hasDocument":true' "$DETAIL"
not_contains "detail NEVER leaks documentImage value" '127.0.0.1:3199' "$DETAIL"
APP_ID=$(echo "$DETAIL" | python3 -c "import json,sys;d=json.load(sys.stdin);print([a['id'] for a in d['applications'] if a['status']=='pending'][0])")

echo "── 5. Document proxy ──"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/admin/marketplace-sellers/$SELLER_C/document?app=$APP_ID")
check "anonymous document proxy → 401" 401 "$code"
CT=$(curl -s -o /dev/null -w '%{content_type}' -H "$COOKIE_ADMIN" "$BASE/api/admin/marketplace-sellers/$SELLER_C/document?app=$APP_ID")
check "admin document proxy streams png" 'image/png' "$CT"
code=$(curl -s -o /dev/null -w '%{http_code}' -H "$COOKIE_SUPPORT" "$BASE/api/admin/marketplace-sellers/$SELLER_C/document?app=$APP_ID")
check "support (administrator) can view document" 200 "$code"

echo "── 6. Public feed contains seller C product (pre-suspension) ──"
FEED=$(curl -s "$BASE/api/products")
contains "P9 C Active in public feed" 'P9 C Active' "$FEED"

echo "── 7. RBAC on actions ──"
code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H "$COOKIE_SUPPORT" -H 'Content-Type: application/json' \
  -d '{"action":"suspend","reason":"x"}' "$BASE/api/admin/marketplace-sellers/$SELLER_C")
check "support suspend → 403" 403 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H "$COOKIE_SNP" -H 'Content-Type: application/json' \
  -d '{"action":"suspend","reason":"x"}' "$BASE/api/admin/marketplace-sellers/$SELLER_C")
check "staff WITHOUT permission suspend → 403" 403 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H "$COOKIE_STAFF" -H 'Content-Type: application/json' \
  -d '{"action":"suspend","reason":""}' "$BASE/api/admin/marketplace-sellers/$SELLER_C")
check "staff WITH permission suspend without reason → 400" 400 "$code"

echo "── 8. Suspend seller C ──"
SUS=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"suspend","reason":"Phase 9 test suspension"}' "$BASE/api/admin/marketplace-sellers/$SELLER_C")
contains "suspend succeeds" '"success":true' "$SUS"
FEED2=$(curl -s "$BASE/api/products")
not_contains "suspended seller products hidden from public feed" 'P9 C Active' "$FEED2"
MON=$(curl -s -H "$COOKIE_ADMIN" "$BASE/api/admin/marketplace-monitor")
contains "monitor shows suspended count >= 1" '"suspendedSellers":1' "$MON"
NOTIF=$(curl -s -H "$COOKIE_SELLER_C" "$BASE/api/notifications")
contains "seller C got suspension notification" 'Phase 9 test suspension' "$NOTIF"
AUD=$(curl -s -H "$COOKIE_ADMIN" "$BASE/api/admin/order-audit?targetType=seller")
contains "audit log has seller_suspended" 'seller_suspended' "$AUD"

echo "── 9. Suspended seller gates ──"
code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H "$COOKIE_SELLER_C" -H 'Content-Type: application/json' \
  -d '{"description":"hacked"}' "$BASE/api/products/$PROD_C_ACTIVE")
check "suspended seller cannot edit product → 403" 403 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "$COOKIE_SELLER_C" -H 'Content-Type: application/json' \
  -d '{"title":"nope","description":"nope","price":10,"category":"other","itemType":"non_physical"}' "$BASE/api/products")
check "suspended seller cannot create product → 403" 403 "$code"

echo "── 10. Reactivate + restrict ──"
REA=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"reactivate"}' "$BASE/api/admin/marketplace-sellers/$SELLER_C")
contains "reactivate succeeds" '"success":true' "$REA"
FEED3=$(curl -s "$BASE/api/products")
contains "products visible again after reactivation" 'P9 C Active' "$FEED3"
RES=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"restrict","reason":"Phase 9 permanent test"}' "$BASE/api/admin/marketplace-sellers/$SELLER_C")
contains "restrict succeeds" '"success":true' "$RES"
code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"reactivate"}' "$BASE/api/admin/marketplace-sellers/$SELLER_C")
check "reactivate blocked while restricted → 409" 409 "$code"
LIFT=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"lift_restriction"}' "$BASE/api/admin/marketplace-sellers/$SELLER_C")
contains "lift restriction succeeds" '"success":true' "$LIFT"
FEED4=$(curl -s "$BASE/api/products")
not_contains "lift only clears the flag — seller still suspended" 'P9 C Active' "$FEED4"
# Reactivate for a clean state:
curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' -d '{"action":"reactivate"}' \
  "$BASE/api/admin/marketplace-sellers/$SELLER_C" > /dev/null
FEED4B=$(curl -s "$BASE/api/products")
contains "reactivated after lift — products visible again" 'P9 C Active' "$FEED4B"

echo "── 11. Product moderation: reject → seller edit → re-pending → approve ──"
REJ=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"reject","reason":"Phase 9 rejection reason"}' "$BASE/api/admin/marketplace-products/$PROD_A_PENDING")
contains "reject succeeds" '"success":true' "$REJ"
PLIST=$(curl -s -H "$COOKIE_ADMIN" "$BASE/api/admin/marketplace-products?q=P9%20A%20Pending")
contains "moderationNote stored" 'Phase 9 rejection reason' "$PLIST"
NOTIF_A=$(curl -s -H "$COOKIE_SELLER_A" "$BASE/api/notifications")
contains "seller A notified of rejection" 'Phase 9 rejection reason' "$NOTIF_A"
EDIT=$(curl -s -X PATCH -H "$COOKIE_SELLER_A" -H 'Content-Type: application/json' \
  -d '{"description":"edited after rejection — should go back to pending"}' "$BASE/api/products/$PROD_A_PENDING")
contains "seller edit resets rejected → pending" '"status":"pending"' "$EDIT"
PENDING_LIST=$(curl -s -H "$COOKIE_ADMIN" "$BASE/api/admin/pending-products")
contains "pending-products panel sees resubmitted product" 'P9 A Pending' "$PENDING_LIST"
APP=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"approve"}' "$BASE/api/admin/marketplace-products/$PROD_A_PENDING")
contains "approve succeeds" '"success":true' "$APP"

echo "── 12. Unpublish → public 404 → restore ──"
UNP=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"unpublish","reason":"Phase 9 unpublish"}' "$BASE/api/admin/marketplace-products/$PROD_B_ACTIVE")
contains "unpublish succeeds" '"success":true' "$UNP"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/products/$PROD_B_ACTIVE")
check "unpublished product detail anonymous → 404" 404 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' -H "$COOKIE_SELLER_A" -X PATCH -H 'Content-Type: application/json' -d '{}' "$BASE/api/products/$PROD_A_ACTIVE")
check "owner still edits own product (unpublished loop path)" 200 "$code"
RST=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"restore"}' "$BASE/api/admin/marketplace-products/$PROD_B_ACTIVE")
contains "restore succeeds" '"success":true' "$RST"
DETAIL_B=$(curl -s "$BASE/api/products/$PROD_B_ACTIVE")
contains "restored product public again" '"success":true' "$DETAIL_B"

echo "── 13. Remove → seller edit blocked ──"
RM=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"remove","reason":"Phase 9 removal"}' "$BASE/api/admin/marketplace-products/$PROD_C_ACTIVE")
contains "remove succeeds" '"success":true' "$RM"
code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H "$COOKIE_SELLER_C" -H 'Content-Type: application/json' \
  -d '{"description":"try edit removed"}' "$BASE/api/products/$PROD_C_ACTIVE")
check "removed product not editable by seller → 403" 403 "$code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/products/$PROD_C_ACTIVE")
check "removed product detail anonymous → 404" 404 "$code"

echo "── 14. Flag product → report lifecycle ──"
FLAG=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"flag","reason":"Phase 9 suspicious product"}' "$BASE/api/admin/marketplace-products/$PROD_A_ACTIVE")
contains "flag creates report" '"reportId"' "$FLAG"
REPORT_ID=$(echo "$FLAG" | python3 -c "import json,sys;print(json.load(sys.stdin)['reportId'])")
RPT=$(curl -s -H "$COOKIE_ADMIN" "$BASE/api/admin/moderation-reports")
contains "reports list contains flagged report" 'Phase 9 suspicious product' "$RPT"
SR=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"start_review"}' "$BASE/api/admin/moderation-reports/$REPORT_ID")
contains "start_review succeeds" '"success":true' "$SR"
RS=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"resolve","resolution":"product_unpublished","note":"Phase 9 resolved via report"}' "$BASE/api/admin/moderation-reports/$REPORT_ID")
contains "resolve with product_unpublished succeeds" '"success":true' "$RS"
PLIST2=$(curl -s -H "$COOKIE_ADMIN" "$BASE/api/admin/marketplace-products?q=P9%20A%20Active")
contains "product actually unpublished via report" '"status":"unpublished"' "$PLIST2"
AUDIT2=$(curl -s -H "$COOKIE_ADMIN" "$BASE/api/admin/order-audit?targetType=moderation_report")
contains "audit has report_resolved" 'report_resolved' "$AUDIT2"

echo "── 15. Seller report → resolve with suspension ──"
# create report via sellers endpoint action=report
RPT2=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"report","reason":"Phase 9 seller report","details":"scam suspicion"}' "$BASE/api/admin/marketplace-sellers/$SELLER_B")
contains "seller report created" '"reportId"' "$RPT2"
REPORT2=$(echo "$RPT2" | python3 -c "import json,sys;print(json.load(sys.stdin)['reportId'])")
# support can decide? No — support is read-only:
code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H "$COOKIE_SUPPORT" -H 'Content-Type: application/json' \
  -d '{"action":"resolve","resolution":"no_action","note":"x"}' "$BASE/api/admin/moderation-reports/$REPORT2")
check "support cannot decide reports → 403" 403 "$code"
RS2=$(curl -s -X PATCH -H "$COOKIE_STAFF" -H 'Content-Type: application/json' \
  -d '{"action":"resolve","resolution":"seller_suspended","note":"Phase 9 suspending via report"}' "$BASE/api/admin/moderation-reports/$REPORT2")
contains "staff resolves with seller_suspended" '"success":true' "$RS2"
MON2=$(curl -s -H "$COOKIE_ADMIN" "$BASE/api/admin/marketplace-monitor")
contains "seller B now suspended (monitor)" '"suspendedSellers":1' "$MON2"
FEED5=$(curl -s "$BASE/api/products")
not_contains "seller B products hidden after report-suspension" 'P9 B Active' "$FEED5"

echo "── 16. Report reject path ──"
RPT3=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"flag","reason":"Phase 9 false report test"}' "$BASE/api/admin/marketplace-products/$PROD_A_ACTIVE")
REPORT3=$(echo "$RPT3" | python3 -c "import json,sys;print(json.load(sys.stdin)['reportId'])")
code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"reject"}' "$BASE/api/admin/moderation-reports/$REPORT3")
check "reject without note → 400" 400 "$code"
RJ=$(curl -s -X PATCH -H "$COOKIE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"action":"reject","note":"not valid"}' "$BASE/api/admin/moderation-reports/$REPORT3")
contains "reject with note succeeds" '"success":true' "$RJ"

echo "── 17. Monitor + audit integration ──"
MON3=$(curl -s -H "$COOKIE_ADMIN" "$BASE/api/admin/marketplace-monitor")
contains "monitor has sellers block" '"totalSellers"' "$MON3"
contains "monitor has recent activity" '"recent"' "$MON3"
AUDIT3=$(curl -s -H "$COOKIE_ADMIN" "$BASE/api/admin/order-audit?targetType=product")
contains "audit has product_rejected" 'product_rejected' "$AUDIT3"
contains "audit has product_unpublished" 'product_unpublished' "$AUDIT3"

echo ""
echo "════════════════════════════════"
echo "PASS: $PASS  FAIL: $FAIL"
echo "════════════════════════════════"
[ "$FAIL" -eq 0 ] && echo "ALL PASS" || echo "SOME FAILED"
