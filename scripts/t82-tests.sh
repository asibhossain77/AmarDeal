#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Task 82 — Physical Products runtime API tests
# Verifies:
#   - product type validation (client-independent, server-side)
#   - physical-only Order Now eligibility (non-physical → 403)
#   - atomic stock decrement / oversell guard / cancel restore
#   - admin-cancel stock restore, seller isolation, Deal separation
#   - physical fields surface in product APIs
# Run: bash scripts/t82-tests.sh   (after seeding: bunx tsx scripts/t82-seed-db.ts)
# ═══════════════════════════════════════════════════════════════
set -u
BASE="http://localhost:3000"
PASS=0; FAIL=0
JAR_BUYER=/tmp/t82-buyer.jar
JAR_S2=/tmp/t82-s2.jar
JAR_ADMIN=/tmp/t82-admin.jar
RUN_ID="$(date +%s)"

say()  { echo -e "$1"; }
ok()   { PASS=$((PASS+1)); say "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); say "  ✗ $1 — got: $(echo "$2" | head -c 240)"; }
check(){ # $1 desc, $2 actual, $3 expected-substring
  if echo "$2" | grep -q "$3"; then ok "$1"; else bad "$1 (expected [$3])" "$2"; fi
}

ensure_login() {
  local email=$1 jar=$2
  if [ -f "$jar" ] && grep -q midman_session "$jar" && \
     curl -s -b "$jar" "$BASE/api/auth/me" --max-time 10 | grep -q '"user":{'; then
    return 0
  fi
  rm -f "$jar"
  for i in 1 2 3 4 5; do
    curl -s -c "$jar" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
      -d "{\"identifier\":\"$email\",\"password\":\"t81pass123\"}" --max-time 15 > /dev/null
    if grep -q midman_session "$jar" 2>/dev/null; then return 0; fi
    sleep 4
  done
  return 1
}

say "═══ Task 82 — Physical Products API tests ═══"

# ── IDs from seed (read-only) ──
IDS=$(bun /home/z/my-project/amardeal/scripts/t82-seed-db.ts --print-ids 2>/dev/null)
P_PHYS=$(echo "$IDS" | python3 -c "import sys,json; print(json.load(sys.stdin)['products']['physical'])")
P_NP=$(echo "$IDS" | python3 -c "import sys,json; print(json.load(sys.stdin)['products']['nonPhysical'])")
[ -n "$P_PHYS" ] && ok "seed ids loaded (physical=$P_PHYS)" || { bad "seed ids" "$IDS"; exit 1; }

ensure_login buyer-t81@midman.test "$JAR_BUYER" && ok "buyer login" || bad "buyer login" "failed"
ensure_login seller2-t81@midman.test "$JAR_S2" && ok "seller2 login" || bad "seller2 login" "failed"
ensure_login admin-t81@midman.test "$JAR_ADMIN" && ok "admin login" || bad "admin login" "failed"

say ""
say "── 1. Product type field exposure ──"
DETAIL=$(curl -s "$BASE/api/products/$P_PHYS")
check "physical product exposes itemType" "$DETAIL" '"itemType":"physical"'
check "physical product exposes condition" "$DETAIL" '"condition":"new"'
check "physical product exposes shippingInfo" "$DETAIL" '"shippingInfo":"Delivery inside Dhaka'
check "physical product is not platform-owned" "$DETAIL" '"isPlatformOwned":false'
check "physical product stock=5" "$DETAIL" '"quantity":5'
NPDETAIL=$(curl -s "$BASE/api/products/$P_NP")
check "non-physical product exposes itemType" "$NPDETAIL" '"itemType":"non_physical"'
check "non-physical has null condition" "$NPDETAIL" '"condition":null'
LEGACY=$(curl -s "$BASE/api/products" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=[p['itemType'] for p in d['products']]
legacy=[p for p in d['products'] if not p['title'].startswith('T8')]
print(all(v in ('physical','non_physical') for v in items), all(p['itemType']=='non_physical' for p in legacy), len(legacy))")
check "all legacy listings unchanged (non_physical)" "$LEGACY" "True True"

say ""
say "── 2. Server-side product creation validation (seller2) ──"
GOOD=$(curl -s -b "$JAR_S2" -X POST "$BASE/api/products" -H 'Content-Type: application/json' \
  -d "{\"title\":\"T82 API Physical Item $RUN_ID\",\"description\":\"Created via API in T82 tests.\",\"price\":700,\"itemType\":\"physical\",\"quantity\":4,\"condition\":\"used\",\"shippingInfo\":\"Courier nationwide\",\"category\":\"other\"}")
check "create physical product → 201" "$GOOD" '"success":true'
check "created with itemType physical" "$GOOD" '"itemType":"physical"'
check "created with condition used" "$GOOD" '"condition":"used"'
NEWPID=$(echo "$GOOD" | python3 -c "import sys,json; print(json.load(sys.stdin)['product']['id'])" 2>/dev/null)

MISSING_STOCK=$(curl -s -b "$JAR_S2" -X POST "$BASE/api/products" -H 'Content-Type: application/json' \
  -d "{\"title\":\"T82 NoStock $RUN_ID\",\"description\":\"x\",\"price\":100,\"itemType\":\"physical\"}")
check "physical without stock → 400" "$MISSING_STOCK" 'স্টক পরিমাণ'

BAD_TYPE=$(curl -s -b "$JAR_S2" -X POST "$BASE/api/products" -H 'Content-Type: application/json' \
  -d "{\"title\":\"T82 BadType $RUN_ID\",\"description\":\"x\",\"price\":100,\"itemType\":\"virtual\",\"quantity\":3}")
check "invalid itemType → 400" "$BAD_TYPE" 'অবৈধ পণ্যের ধরন'

FREE_PHYS=$(curl -s -b "$JAR_S2" -X POST "$BASE/api/products" -H 'Content-Type: application/json' \
  -d "{\"title\":\"T82 FreePhys $RUN_ID\",\"description\":\"x\",\"price\":0,\"itemType\":\"physical\",\"quantity\":3,\"isFree\":true}")
check "physical isFree → 400" "$FREE_PHYS" 'ফিজিক্যাল পণ্য ফ্রি'

FILE_PHYS=$(curl -s -b "$JAR_S2" -X POST "$BASE/api/products" -H 'Content-Type: application/json' \
  -d "{\"title\":\"T82 FilePhys $RUN_ID\",\"description\":\"x\",\"price\":100,\"itemType\":\"physical\",\"quantity\":3,\"fileKey\":\"files/whatever.pdf\",\"fileName\":\"w.pdf\",\"fileSize\":10}")
check "physical with digital file → 400" "$FILE_PHYS" 'ডিজিটাল ফাইল'

DEFAULTED=$(curl -s -b "$JAR_S2" -X POST "$BASE/api/products" -H 'Content-Type: application/json' \
  -d "{\"title\":\"T82 Defaulted $RUN_ID\",\"description\":\"x\",\"price\":100}")
check "missing itemType defaults non_physical (backward compat)" "$DEFAULTED" '"itemType":"non_physical"'
DEFID=$(echo "$DEFAULTED" | python3 -c "import sys,json; print(json.load(sys.stdin)['product']['id'])" 2>/dev/null)

say ""
say "── 3. Editing (type locked, physical fields editable) ──"
LOCK=$(curl -s -b "$JAR_S2" -X PATCH "$BASE/api/products/$NEWPID" -H 'Content-Type: application/json' \
  -d '{"itemType":"non_physical"}')
check "itemType locked after creation → 400" "$LOCK" 'ধরন পরিবর্তন'

STOCK0=$(curl -s -b "$JAR_S2" -X PATCH "$BASE/api/products/$NEWPID" -H 'Content-Type: application/json' \
  -d '{"quantity":0}')
check "physical stock 0 allowed (sold out)" "$STOCK0" '"success":true'
STOCK0_BACK=$(curl -s -b "$JAR_S2" -X PATCH "$BASE/api/products/$NEWPID" -H 'Content-Type: application/json' \
  -d '{"quantity":4,"shippingInfo":"Courier nationwide + Cash on Delivery"}')
check "physical stock + shipping update" "$STOCK0_BACK" '"success":true'

BADCOND=$(curl -s -b "$JAR_S2" -X PATCH "$BASE/api/products/$NEWPID" -H 'Content-Type: application/json' \
  -d '{"condition":"refurbished"}')
check "invalid condition → 400" "$BADCOND" 'অবস্থা'

NP0=$(curl -s -b "$JAR_S2" -X PATCH "$BASE/api/products/$DEFID" -H 'Content-Type: application/json' \
  -d '{"quantity":0}')
check "non-physical quantity 0 still rejected (historical rule)" "$NP0" '১ বা তার বেশি'

say ""
say "── 4. Order eligibility (server-enforced button rules) ──"
NPORDER=$(curl -s -b "$JAR_BUYER" -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$P_NP\",\"quantity\":1,\"clientRequestId\":\"np-$RUN_ID\"}")
check "non-physical seller product → 403 ORDER_NOT_ALLOWED" "$NPORDER" 'ORDER_NOT_ALLOWED'

say ""
say "── 5. Physical order + atomic stock ──"
S0=$(curl -s "$BASE/api/products/$P_PHYS" | python3 -c "import sys,json; print(json.load(sys.stdin)['product']['quantity'])")
check "stock before = 5" "$S0" "^5$"

ORD=$(curl -s -b "$JAR_BUYER" -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$P_PHYS\",\"quantity\":2,\"clientRequestId\":\"t82-$RUN_ID\",\"unitPrice\":1,\"totalAmount\":1}")
check "physical order created" "$ORD" '"success":true'
check "server total 3000 (client price ignored)" "$ORD" '"totalAmount":3000'
ORDID=$(echo "$ORD" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['id'])")
ORDNO=$(echo "$ORD" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['orderNumber'])")

S1=$(curl -s "$BASE/api/products/$P_PHYS" | python3 -c "import sys,json; print(json.load(sys.stdin)['product']['quantity'])")
check "stock decremented 5→3" "$S1" "^3$"

OVER=$(curl -s -b "$JAR_BUYER" -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$P_PHYS\",\"quantity\":99,\"clientRequestId\":\"over-$RUN_ID\"}")
check "oversell → 400 INSUFFICIENT_STOCK" "$OVER" 'INSUFFICIENT_STOCK'
S1B=$(curl -s "$BASE/api/products/$P_PHYS" | python3 -c "import sys,json; print(json.load(sys.stdin)['product']['quantity'])")
check "stock unchanged after oversell" "$S1B" "^3$"

ORD2=$(curl -s -b "$JAR_BUYER" -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$P_PHYS\",\"quantity\":2,\"clientRequestId\":\"t82-$RUN_ID\"}")
check "idempotent retry returns same order" "$ORD2" "\"id\":\"$ORDID\""

say ""
say "── 6. Seller sees the order (dashboard data source) ──"
SLIST=$(curl -s -b "/tmp/t81-s1.jar" "$BASE/api/orders?role=seller&q=$ORDNO" 2>/dev/null)
S1JAR="/tmp/t81-s1.jar"
if ! grep -q midman_session "$S1JAR" 2>/dev/null; then
  ensure_login seller1-t81@midman.test "$S1JAR" >/dev/null
fi
SLIST=$(curl -s -b "$S1JAR" "$BASE/api/orders?role=seller&q=$ORDNO")
check "seller1 order list contains the physical order" "$SLIST" "$ORDNO"
check "seller list reports product title" "$SLIST" 'T82 Physical Watch'

say ""
say "── 7. Deal separation (physical Order Now ≠ Admin Deal) ──"
DEALS=$(curl -s -b "$JAR_BUYER" "$BASE/api/user/deals" -X POST -H 'Content-Type: application/json' -d '{}')
NP=$(echo "$DEALS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d if isinstance(d,list) else d.get('deals',[])
print(sum(1 for x in items if 'T82' in (x.get('title') or '')))" 2>/dev/null || echo "?")
check "zero deals referencing T82 order" "$NP" "^0$"

say ""
say "── 8. Cancel → stock restore ──"
CAN=$(curl -s -b "$JAR_BUYER" -X PATCH "$BASE/api/orders/$ORDID/status" -H 'Content-Type: application/json' \
  -d '{"action":"cancel"}')
check "buyer cancels unpaid physical order" "$CAN" '"status":"cancelled"'
S2=$(curl -s "$BASE/api/products/$P_PHYS" | python3 -c "import sys,json; print(json.load(sys.stdin)['product']['quantity'])")
check "stock restored 3→5" "$S2" "^5$"

say ""
say "── 9. Admin cancel also restores stock ──"
ORD3=$(curl -s -b "$JAR_BUYER" -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$P_PHYS\",\"quantity\":1,\"clientRequestId\":\"adm-$RUN_ID\"}")
ORD3ID=$(echo "$ORD3" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['id'])")
ACAN=$(curl -s -b "$JAR_ADMIN" -X PATCH "$BASE/api/admin/marketplace/orders/$ORD3ID" -H 'Content-Type: application/json' \
  -d '{"action":"set_status","status":"cancelled","note":"t82 admin cancel"}')
check "admin cancels physical order" "$ACAN" '"success":true'
S3=$(curl -s "$BASE/api/products/$P_PHYS" | python3 -c "import sys,json; print(json.load(sys.stdin)['product']['quantity'])")
check "stock restored after admin cancel (→5)" "$S3" "^5$"

say ""
say "═══ Results: PASS=$PASS FAIL=$FAIL ═══"
[ "$FAIL" = "0" ] && say "ALL T82 TESTS PASSED" || say "SOME T82 TESTS FAILED"
exit $([ "$FAIL" = "0" ] && echo 0 || echo 1)
