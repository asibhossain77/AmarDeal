#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Task 81 — Marketplace product orders runtime API tests
# (unified MarketplaceOrder contract: shared status vocabulary with
# the SMM direct-order system — pending_payment/queued/processing/
# completed/cancelled/refunded; payment: unpaid → awaiting_verification → paid)
# Verifies: order creation (no Deal!), idempotency, seller isolation,
# ownership enforcement, transition matrix, admin payment verification,
# seller start/complete, digital entitlement, refund, counts.
# ═══════════════════════════════════════════════════════════════
set -u
BASE="http://localhost:3000"
PASS=0; FAIL=0
JAR_BUYER=/tmp/t81-buyer.jar
JAR_S1=/tmp/t81-s1.jar
JAR_S2=/tmp/t81-s2.jar
JAR_ADMIN=/tmp/t81-admin.jar
RUN_ID="$(date +%s)"

say()  { echo -e "$1"; }
ok()   { PASS=$((PASS+1)); say "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); say "  ✗ $1"; }
check(){ # $1 desc, $2 actual, $3 expected-substring
  if echo "$2" | grep -q "$3"; then ok "$1"; else bad "$1 — expected [$3] got: $(echo "$2" | head -c 240)"; fi
}

# ── Login helper with cookie caching + rate-limit backoff (5 logins/min) ──
ensure_login() {
  local email=$1 jar=$2
  if [ -f "$jar" ] && grep -q midman_session "$jar" && \
     curl -s -b "$jar" "$BASE/api/auth/me" --max-time 10 | grep -q '"user":{'; then
    return 0
  fi
  rm -f "$jar"
  for attempt in 1 2 3 4 5; do
    RES=$(curl -s -c "$jar" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
      -d "{\"identifier\":\"$email\",\"password\":\"t81pass123\"}" --max-time 15)
    if grep -q midman_session "$jar"; then
      sleep 1
      return 0
    fi
    if echo "$RES" | grep -q RATE_LIMITED; then
      sleep 25
    else
      sleep 3
    fi
  done
  return 1
}

# ── IDs from seed (READ-ONLY — do not wipe, sessions must stay valid) ──
IDS=$(bun /home/z/my-project/amardeal/scripts/t81-seed-db.ts --print-ids 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['admin'],d['seller1'],d['seller2'],d['buyer'],d['bkashId'],d['products']['single'],d['products']['smm'],d['products']['digital'],d['products']['platformOwned'])")
read -r ADMIN_ID S1_ID S2_ID BUYER_ID BKASH_ID P_SINGLE P_SMM P_DIGITAL P_PLATFORM <<< "$IDS"
say "seed: seller1=$S1_ID buyer=$BUYER_ID single=$P_SINGLE smm=$P_SMM digital=$P_DIGITAL platform=$P_PLATFORM"

ensure_login buyer-t81@midman.test "$JAR_BUYER"
ensure_login seller1-t81@midman.test "$JAR_S1"
ensure_login seller2-t81@midman.test "$JAR_S2"
ensure_login admin-t81@midman.test "$JAR_ADMIN"
grep -q midman_session "$JAR_BUYER" && ok "buyer login" || bad "buyer login failed"
grep -q midman_session "$JAR_S1" && ok "seller1 login" || bad "seller1 login failed"
grep -q midman_session "$JAR_ADMIN" && ok "admin login" || bad "admin login failed"

detail_field() { # $1 jar, $2 order id, $3 python expr on order dict
  curl -s -b "$1" "$BASE/api/marketplace/orders/$2" | python3 -c "
import sys,json
d=json.load(sys.stdin)
o=d.get('order') or {}
print($3)
" 2>/dev/null
}

say ""
say "── 1. Order creation (SEPARATION from Admin Deals) ──"
DEALS_BEFORE=$(curl -s -b "$JAR_BUYER" "$BASE/api/user/deals" -X POST -H 'Content-Type: application/json' -d '{}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d if isinstance(d,list) else d.get('deals',[])))" 2>/dev/null || echo "0")

REQ_ID="web-test-$(date +%s)"
CREATE=$(curl -s -b "$JAR_BUYER" -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$P_SINGLE\",\"quantity\":2,\"clientRequestId\":\"$REQ_ID\"}")
check "create single-product order (×2)" "$CREATE" '"success":true'
ORDER_ID=$(echo "$CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['id'])")
ORDER_NO=$(echo "$CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['orderNumber'])")
TOTAL=$(echo "$CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['totalAmount'])")
check "server-side total = ৳3000 (1500×2)" "$TOTAL" "^3000$"
check "status pending_payment" "$CREATE" '"status":"pending_payment"'
check "paymentStatus unpaid" "$CREATE" '"paymentStatus":"unpaid"'

# NO deal may be created
DEALS_AFTER=$(curl -s -b "$JAR_BUYER" "$BASE/api/user/deals" -X POST -H 'Content-Type: application/json' -d '{}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d if isinstance(d,list) else d.get('deals',[])))" 2>/dev/null || echo "0")
if [ "$DEALS_BEFORE" = "$DEALS_AFTER" ]; then ok "no Deal created by Order Now ($DEALS_BEFORE → $DEALS_AFTER)"; else bad "Deal count changed: $DEALS_BEFORE → $DEALS_AFTER (SEPARATION VIOLATION)"; fi

# idempotency — same clientRequestId returns same order
CREATE2=$(curl -s -b "$JAR_BUYER" -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$P_SINGLE\",\"quantity\":2,\"clientRequestId\":\"$REQ_ID\"}")
ORDER_ID2=$(echo "$CREATE2" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['id'])")
check "idempotent retry returns SAME order" "$ORDER_ID2" "^$ORDER_ID$"
check "idempotent flag" "$CREATE2" '"idempotent":true'

# client-side price tampering ignored (multi requires option)
CREATE3=$(curl -s -b "$JAR_BUYER" -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$P_SMM\",\"quantity\":3,\"clientRequestId\":\"tamper-$(date +%s)\",\"unitPrice\":1,\"totalAmount\":1}")
check "multi without option → 400 (tamper rejected)" "$CREATE3" 'অপশন/প্যাকেজ'

# multi with valid option
SMM_OPTS=$(curl -s "$BASE/api/products/$P_SMM" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['product']['options'][1]['id'])")
CREATE4=$(curl -s -b "$JAR_BUYER" -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$P_SMM\",\"optionId\":\"$SMM_OPTS\",\"quantity\":3,\"clientRequestId\":\"smm-$(date +%s)\",\"unitPrice\":1,\"targetLink\":\"https://facebook.com/midman\"}")
ORDER4_ID=$(echo "$CREATE4" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['id'])")
TOTAL4=$(echo "$CREATE4" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['totalAmount'])")
check "multi+option: server price 2200×3 = 6600 (client price ignored)" "$TOTAL4" "^6600$"

say ""
say "── 2. Seller isolation & ownership (server-enforced) ──"
S1_LIST=$(curl -s -b "$JAR_S1" "$BASE/api/orders?role=seller")
check "seller1 sees own orders" "$S1_LIST" "$ORDER_NO"
S2_LIST=$(curl -s -b "$JAR_S2" "$BASE/api/orders?role=seller")
if echo "$S2_LIST" | grep -q "$ORDER_NO"; then bad "seller2 sees seller1's order (LEAK)"; else ok "seller2 sees zero foreign orders"; fi
S2_COUNT=$(echo "$S2_LIST" | python3 -c "import sys,json; print(json.load(sys.stdin)['counts']['total'])")
check "seller2 total=0" "$S2_COUNT" "^0$"

S2_DETAIL=$(curl -s -b "$JAR_S2" "$BASE/api/marketplace/orders/$ORDER_ID")
check "seller2 detail → 403" "$S2_DETAIL" 'Access denied'
NOAUTH=$(curl -s "$BASE/api/marketplace/orders/$ORDER_ID")
check "anonymous detail → 401" "$NOAUTH" 'NO_SESSION'
S1_VIEWER=$(detail_field "$JAR_S1" "$ORDER_ID" "o.get('viewerRole')")
check "seller1 opens own detail as seller" "$S1_VIEWER" "seller"

# buyer sees the purchase in the EXISTING buyer orders list (one table)
BUYER_LIST=$(curl -s -b "$JAR_BUYER" "$BASE/api/marketplace/orders")
check "buyer sees own purchase in /api/marketplace/orders" "$BUYER_LIST" "$ORDER_NO"

say ""
say "── 3. Status transition matrix ──"
# seller CANNOT complete unpaid
E1=$(curl -s -b "$JAR_S1" -X PATCH "$BASE/api/orders/$ORDER_ID/status" -H 'Content-Type: application/json' -d '{"action":"complete"}')
check "complete unpaid → 409" "$E1" 'INVALID_TRANSITION'
# buyer CANNOT complete
E2=$(curl -s -b "$JAR_BUYER" -X PATCH "$BASE/api/orders/$ORDER_ID/status" -H 'Content-Type: application/json' -d '{"action":"complete"}')
check "buyer complete → 403" "$E2" 'FORBIDDEN'

# buyer submits payment (EXISTING manual payment endpoint)
PAY=$(curl -s -b "$JAR_BUYER" -X POST "$BASE/api/marketplace/orders/$ORDER_ID/payment" -H 'Content-Type: application/json' \
  -d "{\"paymentMethodId\":\"$BKASH_ID\",\"senderNumber\":\"017112345678\",\"transactionId\":\"T81TXN001-$RUN_ID\"}")
check "payment submit accepted" "$PAY" '"success":true'
PS=$(detail_field "$JAR_BUYER" "$ORDER_ID" "o.get('paymentStatus')")
ST=$(detail_field "$JAR_BUYER" "$ORDER_ID" "o.get('status')")
check "paymentStatus → awaiting_verification" "$PS" "awaiting_verification"
check "status stays pending_payment" "$ST" "pending_payment"

# seller CANNOT cancel an order in verification
E3=$(curl -s -b "$JAR_S1" -X PATCH "$BASE/api/orders/$ORDER_ID/status" -H 'Content-Type: application/json' -d '{"action":"cancel"}')
check "seller cancel verifying → 409" "$E3" 'INVALID_TRANSITION'
# seller CANNOT verify payment (admin-only path — unknown action here)
E4=$(curl -s -b "$JAR_S1" -X PATCH "$BASE/api/orders/$ORDER_ID/status" -H 'Content-Type: application/json' -d '{"action":"verify_payment"}')
check "seller verify_payment → 400 (unknown action)" "$E4" 'অবৈধ'

# duplicate txn guard
DUP=$(curl -s -b "$JAR_BUYER" -X POST "$BASE/api/marketplace/orders/$ORDER4_ID/payment" -H 'Content-Type: application/json' \
  -d "{\"paymentMethodId\":\"$BKASH_ID\",\"senderNumber\":\"017112345678\",\"transactionId\":\"T81TXN001-$RUN_ID\"}")
check "duplicate txn → 409" "$DUP" 'আগেই ব্যবহার'

# admin verifies (EXISTING admin endpoint) → queued + paid
VERIFY=$(curl -s -b "$JAR_ADMIN" -X PATCH "$BASE/api/admin/marketplace/orders/$ORDER_ID" -H 'Content-Type: application/json' -d '{"action":"verify_payment"}')
check "admin verify accepted" "$VERIFY" '"success":true'
ST2=$(detail_field "$JAR_S1" "$ORDER_ID" "o.get('status')")
PS2=$(detail_field "$JAR_S1" "$ORDER_ID" "o.get('paymentStatus')")
check "verified → queued" "$ST2" "queued"
check "verified → paid" "$PS2" "paid"

# seller starts fulfilment: queued → processing
START=$(curl -s -b "$JAR_S1" -X PATCH "$BASE/api/orders/$ORDER_ID/status" -H 'Content-Type: application/json' -d '{"action":"start"}')
check "seller starts paid order → processing" "$START" '"status":"processing"'

# now seller CAN complete
DONE=$(curl -s -b "$JAR_S1" -X PATCH "$BASE/api/orders/$ORDER_ID/status" -H 'Content-Type: application/json' -d '{"action":"complete"}')
check "seller completes paid order" "$DONE" '"status":"completed"'

say ""
say "── 4. Digital order completion grants download ──"
DREQ="dig-$(date +%s)"
DCREATE=$(curl -s -b "$JAR_BUYER" -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$P_DIGITAL\",\"quantity\":1,\"clientRequestId\":\"$DREQ\"}")
DORDER_ID=$(echo "$DCREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['id'])")
curl -s -b "$JAR_BUYER" -X POST "$BASE/api/marketplace/orders/$DORDER_ID/payment" -H 'Content-Type: application/json' \
  -d "{\"paymentMethodId\":\"$BKASH_ID\",\"senderNumber\":\"017199999999\",\"transactionId\":\"T81TXN002-$RUN_ID\"}" > /dev/null
curl -s -b "$JAR_ADMIN" -X PATCH "$BASE/api/admin/marketplace/orders/$DORDER_ID" -H 'Content-Type: application/json' -d '{"action":"verify_payment"}' > /dev/null
curl -s -b "$JAR_S1" -X PATCH "$BASE/api/orders/$DORDER_ID/status" -H 'Content-Type: application/json' -d '{"action":"start"}' > /dev/null
curl -s -b "$JAR_S1" -X PATCH "$BASE/api/orders/$DORDER_ID/status" -H 'Content-Type: application/json' -d '{"action":"complete"}' > /dev/null
ENT2=$(curl -s -b "$JAR_BUYER" "$BASE/api/download/$P_DIGITAL/info" | python3 -c "import sys,json; print(json.load(sys.stdin).get('entitled'))")
check "digital order complete → buyer entitled" "$ENT2" "True"
say ""
say "── 5. Refund (admin only, existing set_status path) ──"
REFUND_BY_SELLER=$(curl -s -b "$JAR_S1" -X PATCH "$BASE/api/orders/$ORDER_ID/status" -H 'Content-Type: application/json' -d '{"action":"refund"}')
check "seller refund → 400 (no such action)" "$REFUND_BY_SELLER" 'অবৈধ'
REFUND=$(curl -s -b "$JAR_ADMIN" -X PATCH "$BASE/api/admin/marketplace/orders/$ORDER_ID" -H 'Content-Type: application/json' -d '{"action":"set_status","status":"refunded","note":"customer request"}')
check "admin refund accepted" "$REFUND" '"success":true'
RST=$(detail_field "$JAR_BUYER" "$ORDER_ID" "o.get('status')")
check "order now refunded" "$RST" "refunded"

say ""
say "── 6. Buyer cancel own unpaid order ──"
CREQ="cancel-$(date +%s)"
CCREATE=$(curl -s -b "$JAR_BUYER" -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$P_SINGLE\",\"quantity\":1,\"clientRequestId\":\"$CREQ\"}")
CORDER_ID=$(echo "$CCREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['id'])")
CANCEL=$(curl -s -b "$JAR_BUYER" -X PATCH "$BASE/api/orders/$CORDER_ID/status" -H 'Content-Type: application/json' -d '{"action":"cancel"}')
check "buyer cancels own unpaid order" "$CANCEL" '"status":"cancelled"'
# seller2 cannot touch it (not theirs)
S2CANCEL=$(curl -s -b "$JAR_S2" -X PATCH "$BASE/api/orders/$CORDER_ID/status" -H 'Content-Type: application/json' -d '{"action":"cancel"}')
check "seller2 cancel foreign unpaid → 403" "$S2CANCEL" 'FORBIDDEN'

say ""
say "── 7. Platform-owned orders (admin view) ──"
PREQ="plat-$(date +%s)"
PCREATE=$(curl -s -b "$JAR_BUYER" -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$P_PLATFORM\",\"quantity\":1,\"clientRequestId\":\"$PREQ\"}")
check "buyer can order platform-owned product" "$PCREATE" '"success":true'
PORDER_ID=$(echo "$PCREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['id'])")
PO=$(curl -s -b "$JAR_ADMIN" "$BASE/api/admin/orders?platformOwned=1")
check "admin platformOwned=1 shows it" "$PO" '"isPlatformOwned":true'
P_COUNT=$(echo "$PO" | python3 -c "import sys,json; print(json.load(sys.stdin)['counts']['total'])")
check "platform count >= 1" "$P_COUNT" "^[1-9]"
# seller1 must NOT see it
S1_CHECK=$(curl -s -b "$JAR_S1" "$BASE/api/orders?role=seller")
if echo "$S1_CHECK" | grep -q "$PORDER_ID"; then bad "seller sees platform order (LEAK)"; else ok "regular seller blind to platform-owned order"; fi
# admin detail access works (admin is neither buyer nor seller of it)
ADMIN_DETAIL=$(curl -s -b "$JAR_ADMIN" "$BASE/api/marketplace/orders/$PORDER_ID")
check "admin can open platform order detail" "$ADMIN_DETAIL" '"viewerRole":"admin"'

say ""
say "── 8. Counts, search, filters, sort ──"
CNT=$(curl -s -b "$JAR_S1" "$BASE/api/orders?role=seller" | python3 -c "import sys,json; d=json.load(sys.stdin)['counts']; print(d['total']>=3, d['completed']>=1, d['refunded']>=1, d['cancelled']>=1)")
check "seller1 counts reflect lifecycle (total/completed/refunded/cancelled)" "$CNT" "True True True True"
SEARCH=$(curl -s -b "$JAR_S1" "$BASE/api/orders?role=seller&q=$ORDER_NO" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['orders']))")
check "search by order number" "$SEARCH" "^1$"
FILTERED=$(curl -s -b "$JAR_S1" "$BASE/api/orders?role=seller&status=completed" | python3 -c "import sys,json; d=json.load(sys.stdin); print(all(o['status']=='completed' for o in d['orders']) and len(d['orders'])>=1)")
check "status filter works" "$FILTERED" "True"
SORT=$(curl -s -b "$JAR_S1" "$BASE/api/orders?role=seller&sort=amount_desc" | python3 -c "import sys,json; a=[o['totalAmount'] for o in json.load(sys.stdin)['orders']]; print(a==sorted(a,reverse=True))")
check "sort amount desc" "$SORT" "True"
DATE=$(curl -s -b "$JAR_S1" "$BASE/api/orders?role=seller&from=2030-01-01" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
check "future date filter → 0" "$DATE" "^0$"

say ""
say "════════════════════════════════════"
say "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ] && say "ALL TESTS PASSED" || say "SOME TESTS FAILED"
exit $FAIL
