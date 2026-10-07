#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Task 60 — OAuth provider FULL FLOW regression suite
#
# Covers the complete consent → code → redirect → token → userinfo path
# plus every fail-closed branch, CSRF guards, single-use/expiry semantics
# and the 303 (NOT 307) consent-redirect regression test.
#
# Single bash call: seed user → start next dev → curl assertions → kill.
# Local SQLite only (file: db/custom.db). No production secrets used.
# ─────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")/.."
ROOT="$PWD"

PORT=3100
BASE="http://localhost:$PORT"
DB="file:$ROOT/db/custom.db"
LOG="/home/z/my-project/scripts/task60-next.log"

# Test-only secrets (sandbox local — NOT production credentials)
export OAUTH_SECRET="task60-test-secret-0123456789abcdef0123456789abcdef"
export OAUTH_CLIENT_VERIFY_SECRET="task60-test-client-secret-0123456789"
export NEXT_PUBLIC_APP_URL="$BASE"
export DATABASE_URL="$DB"

REDIRECT_URI="https://verify.midman.bd/auth/callback"
CLIENT_SECRET="$OAUTH_CLIENT_VERIFY_SECRET"
EMAIL="task60-oauth-test@midman.local"
PASSWORD="task60-Pass-w0rd!"
COOKIES="/home/z/my-project/scripts/task60-cookies.txt"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  PASS: $1"; }
bad() { FAIL=$((FAIL+1)); echo "  FAIL: $1${2:+ [$2]}"; }
assert() { # $1 desc  $2 condition result (0=ok)
  if [ "$2" -eq 0 ]; then ok "$1"; else bad "$1"; fi
}

echo "── Task 60 OAuth full-flow tests ──"

# ── 0. reset env ──
pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null
sleep 1
rm -f "$COOKIES" "$LOG"

echo "→ seeding test user"
bun scripts/task60-helpers.ts seed >/dev/null || { echo "seed failed"; exit 1; }

echo "→ starting next dev on :$PORT"
nohup bunx next dev -p $PORT >"$LOG" 2>&1 &
SERVER_PID=$!
READY=1
for i in $(seq 1 90); do
  if curl -s --max-time 3 -o /dev/null "$BASE/api/health"; then READY=0; break; fi
  sleep 1
done
assert "server ready" $READY || { tail -20 "$LOG"; exit 1; }

# ── helpers ──
hex() { openssl rand -hex "$1"; }

# PKCE pair: verifier (64 hex chars, valid RFC 7636 charset) + S256 challenge
make_pkce() {
  VERIFIER=$(hex 32)
  CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -sha256 -binary | openssl base64 | tr '+/' '-_' | tr -d '=\n')
}

status_of()  { sed -n 's/HTTP\/1\.[01] \([0-9]*\).*/\1/p' <<<"$1" | head -1; }
location_of(){ grep -i '^location:' <<<"$1" | head -1 | sed 's/^[Ll]ocation: *//' | tr -d '\r'; }

# Full authorize→consent→code issuance for one PKCE pair; echoes "ct code"
issue_code() { # $1 ip $2 state $3 decision(continue|deny)
  local ip="$1" st="$2" decision="${3:-continue}"
  local auth_url="$BASE/oauth/authorize?client_id=midman-verify&redirect_uri=https%3A%2F%2Fverify.midman.bd%2Fauth%2Fcallback&response_type=code&scope=openid%20profile%20email&state=$st&code_challenge=$CHALLENGE&code_challenge_method=S256"
  local hdr ct loc2
  hdr=$(curl -s --max-time 60 -D - -o /dev/null -b "$COOKIES" "$auth_url")
  loc2=$(location_of "$hdr")
  ct="${loc2#*ct=}"
  [ "$decision" = "continue" ] || { echo "DENYREDIR $loc2"; return; }
  hdr=$(curl -s --max-time 60 -D - -o /dev/null -b "$COOKIES" -H "Origin: $BASE" \
        -H "x-forwarded-for: $ip" \
        --data-urlencode "consent_token=$ct" -d "decision=continue" \
        "$BASE/api/oauth/authorize")
  loc2=$(location_of "$hdr")
  echo "${loc2#*code=}" | sed 's/&state=.*//' >/dev/null
  echo "CT:$ct CODE:$(printf '%s' "$loc2" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p') LOC:$loc2"
}

token_req() { # $1 code $2 verifier $3 ip $4 secret $5 redirect $6 grant
  local body
  body=$(printf '{"grant_type":"%s","client_id":"midman-verify","client_secret":"%s","code":"%s","redirect_uri":"%s","code_verifier":"%s"}' \
    "${6:-authorization_code}" "${4:-$CLIENT_SECRET}" "$1" "${5:-$REDIRECT_URI}" "$2")
  curl -s --max-time 60 -X POST -H 'Content-Type: application/json' -H "x-forwarded-for: $3" --data "$body" "$BASE/api/oauth/token"
}

# ════════════════ A. Logged-out user ════════════════
echo "▶ A. logged-out user bounces to login"
make_pkce
AUTH_URL="$BASE/oauth/authorize?client_id=midman-verify&redirect_uri=https%3A%2F%2Fverify.midman.bd%2Fauth%2Fcallback&response_type=code&scope=openid%20profile%20email&state=prelogin&code_challenge=$CHALLENGE&code_challenge_method=S256"
HDR=$(curl -s --max-time 60 -D - -o /dev/null "$AUTH_URL")
LOC=$(location_of "$HDR")
[ "$(status_of "$HDR")" = "302" ]; assert "A1 unauthenticated → 302" $?
[[ "$LOC" == *"/login?next="* ]]; assert "A2 redirect target is /login?next=" $?

# ════════════════ B. fail-closed client / redirect ════════════════
echo "▶ B. unknown client & unregistered redirect fail closed"
HDR=$(curl -s --max-time 60 -D - -o /dev/null "$BASE/oauth/authorize?client_id=evil-app&redirect_uri=https%3A%2F%2Fverify.midman.bd%2Fauth%2Fcallback&response_type=code&scope=openid&state=x&code_challenge=$CHALLENGE&code_challenge_method=S256")
LOC=$(location_of "$HDR")
[[ "$LOC" == *"/oauth/error?code=invalid_client"* ]]; assert "B1 unknown client → internal error page" $?

HDR=$(curl -s --max-time 60 -D - -o /dev/null "$BASE/oauth/authorize?client_id=midman-verify&redirect_uri=https%3A%2F%2Fevil.example.com%2Fcb&response_type=code&scope=openid&state=x&code_challenge=$CHALLENGE&code_challenge_method=S256")
LOC=$(location_of "$HDR")
[[ "$LOC" == *"/oauth/error?code=invalid_redirect"* ]]; assert "B2 unregistered redirect_uri → internal error page" $?
[[ "$LOC" != *"evil.example.com"* ]]; assert "B3 never redirects to unregistered destination" $?

# ════════════════ C. protocol error redirects (to client callback) ════════════════
echo "▶ C. protocol errors → error+state to registered callback"
proto_case() { # $1 desc $2 query
  HDR=$(curl -s --max-time 60 -D - -o /dev/null "$BASE/oauth/authorize?$2")
  LOC=$(location_of "$HDR")
  [[ "$LOC" == "https://verify.midman.bd/auth/callback?"* ]]; assert "$1 → redirected to registered callback" $?
}
HDR=$(curl -s --max-time 60 -D - -o /dev/null "$BASE/oauth/authorize?client_id=midman-verify&redirect_uri=https%3A%2F%2Fverify.midman.bd%2Fauth%2Fcallback&scope=openid&state=s1&code_challenge=$CHALLENGE&code_challenge_method=S256")
LOC=$(location_of "$HDR"); [[ "$LOC" == *"error=unsupported_response_type"* ]]; assert "C1 missing response_type → unsupported_response_type" $?

proto_case "C2 unknown scope" "client_id=midman-verify&redirect_uri=https%3A%2F%2Fverify.midman.bd%2Fauth%2Fcallback&response_type=code&scope=openid%20read%3Afriends&state=s2&code_challenge=$CHALLENGE&code_challenge_method=S256"
HDR=$(curl -s --max-time 60 -D - -o /dev/null "$BASE/oauth/authorize?client_id=midman-verify&redirect_uri=https%3A%2F%2Fverify.midman.bd%2Fauth%2Fcallback&response_type=code&scope=openid%20read%3Afriends&state=s2&code_challenge=$CHALLENGE&code_challenge_method=S256")
LOC=$(location_of "$HDR"); [[ "$LOC" == *"error=invalid_scope"* ]]; assert "C2b scope error code" $?

HDR=$(curl -s --max-time 60 -D - -o /dev/null "$BASE/oauth/authorize?client_id=midman-verify&redirect_uri=https%3A%2F%2Fverify.midman.bd%2Fauth%2Fcallback&response_type=code&scope=openid&state=s3&code_challenge_method=S256")
LOC=$(location_of "$HDR"); [[ "$LOC" == *"error=invalid_request"* ]]; assert "C3 missing code_challenge → invalid_request" $?

HDR=$(curl -s --max-time 60 -D - -o /dev/null "$BASE/oauth/authorize?client_id=midman-verify&redirect_uri=https%3A%2F%2Fverify.midman.bd%2Fauth%2Fcallback&response_type=code&scope=openid&state=s4&code_challenge=$CHALLENGE&code_challenge_method=plain")
LOC=$(location_of "$HDR"); [[ "$LOC" == *"error=invalid_request"* ]]; assert "C4 plain method rejected (S256-only)" $?

LONGSTATE=$(hex 600)
HDR=$(curl -s --max-time 60 -D - -o /dev/null "$BASE/oauth/authorize?client_id=midman-verify&redirect_uri=https%3A%2F%2Fverify.midman.bd%2Fauth%2Fcallback&response_type=code&scope=openid&state=$LONGSTATE&code_challenge=$CHALLENGE&code_challenge_method=S256")
LOC=$(location_of "$HDR"); [[ "$LOC" == *"error=invalid_request"* ]]; assert "C5 state >1024 chars → invalid_request" $?

# ════════════════ D. logged-in FULL happy path ════════════════
echo "▶ D. login → authorize → consent → 303 code → token → userinfo"
LOGIN=$(curl -s --max-time 60 -c "$COOKIES" -H 'Content-Type: application/json' \
  -H "x-forwarded-for: 10.60.1.1" \
  --data "{\"identifier\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "$BASE/api/auth/login")
[[ "$LOGIN" == *'"email"'* ]]; assert "D0 login OK (session cookie set)" $?

make_pkce; STATE="st_$(hex 8)"
AUTH_URL="$BASE/oauth/authorize?client_id=midman-verify&redirect_uri=https%3A%2F%2Fverify.midman.bd%2Fauth%2Fcallback&response_type=code&scope=openid%20profile%20email&state=$STATE&code_challenge=$CHALLENGE&code_challenge_method=S256"
HDR=$(curl -s --max-time 60 -D - -o /dev/null -b "$COOKIES" "$AUTH_URL")
LOC=$(location_of "$HDR")
[ "$(status_of "$HDR")" = "302" ]; assert "D1 authorize (session) → 302 consent" $?
[[ "$LOC" == *"/oauth/consent?ct="* ]]; assert "D2 consent URL carries signed ct token" $?
CT="${LOC#*ct=}"

CONSENT_HTML=$(curl -s --max-time 60 -b "$COOKIES" "$LOC")
[[ "$CONSENT_HTML" == *"/api/oauth/authorize"* && "$CONSENT_HTML" == *"$EMAIL"* ]]; assert "D3 consent page renders form + user identity" $?

# THE regression test: consent decision MUST answer 303 (POST→GET), never 307
HDR=$(curl -s --max-time 60 -D - -o /dev/null -b "$COOKIES" -H "Origin: $BASE" \
  -H "x-forwarded-for: 10.60.1.2" \
  --data-urlencode "consent_token=$CT" -d "decision=continue" \
  "$BASE/api/oauth/authorize")
DSTATUS=$(status_of "$HDR")
[ "$DSTATUS" = "303" ]; assert "D4 consent accept → HTTP 303 (NOT 307)" $?
[ "$DSTATUS" != "307" ]; assert "D5 no 307 (no form-body re-POST to client)" $?
LOC=$(location_of "$HDR")
[[ "$LOC" == "https://verify.midman.bd/auth/callback?"* ]]; assert "D6 redirect URI is exact registered callback" $?
[[ "$LOC" == *"code=mo_"* ]]; assert "D7 authorization code present (mo_*)" $?
[[ "$LOC" == *"state=$STATE"* ]]; assert "D8 state echoed verbatim" $?

CODE=$(printf '%s' "$LOC" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')
TOK=$(token_req "$CODE" "$VERIFIER" "10.60.1.3" "" "" "")
AT=$(printf '%s' "$TOK" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
[[ "$AT" == mt_* ]]; assert "D9 token exchange → access_token mt_*" $? "$TOK"
[[ "$TOK" == *'"token_type":"Bearer"'* && "$TOK" == *'"expires_in":600'* ]]; assert "D10 Bearer + expires_in=600" $?
[[ "$TOK" == *'"scope":"openid profile email"'* ]]; assert "D11 granted scope echoed" $?

UI=$(curl -s --max-time 60 -H "Authorization: Bearer $AT" "$BASE/api/oauth/userinfo")
[[ "$UI" == *'"sub"'* && "$UI" == *"\"email\":\"$EMAIL\""* ]]; assert "D12 userinfo returns sub + email" $? "$UI"

TOK2=$(token_req "$CODE" "$VERIFIER" "10.60.1.4" "" "" "")
[[ "$TOK2" == *'"invalid_grant"'* ]]; assert "D13 code reuse rejected (single-use)" $? "$TOK2"

# ════════════════ E. deny flow ════════════════
echo "▶ E. deny → access_denied + state"
make_pkce; STATE="st_$(hex 8)"
AUTH_URL="$BASE/oauth/authorize?client_id=midman-verify&redirect_uri=https%3A%2F%2Fverify.midman.bd%2Fauth%2Fcallback&response_type=code&scope=openid&state=$STATE&code_challenge=$CHALLENGE&code_challenge_method=S256"
HDR=$(curl -s --max-time 60 -D - -o /dev/null -b "$COOKIES" "$AUTH_URL")
LOC=$(location_of "$HDR"); CT="${LOC#*ct=}"
HDR=$(curl -s --max-time 60 -D - -o /dev/null -b "$COOKIES" -H "Origin: $BASE" -H "x-forwarded-for: 10.60.2.1" \
  --data-urlencode "consent_token=$CT" -d "decision=deny" "$BASE/api/oauth/authorize")
[ "$(status_of "$HDR")" = "303" ]; assert "E1 deny → 303" $?
LOC=$(location_of "$HDR")
[[ "$LOC" == *"error=access_denied"* && "$LOC" == *"state=$STATE"* ]]; assert "E2 access_denied + state echoed" $?
[[ "$LOC" != *"code=mo_"* ]]; assert "E3 deny issues no code" $?

# ════════════════ F. token endpoint negative matrix ════════════════
echo "▶ F. token endpoint negative matrix"
new_code() { # sets CODE2
  make_pkce; STATE="st_$(hex 8)"
  local auth_url="$BASE/oauth/authorize?client_id=midman-verify&redirect_uri=https%3A%2F%2Fverify.midman.bd%2Fauth%2Fcallback&response_type=code&scope=openid&state=$STATE&code_challenge=$CHALLENGE&code_challenge_method=S256"
  local hdr loc ct
  hdr=$(curl -s --max-time 60 -D - -o /dev/null -b "$COOKIES" "$auth_url")
  loc=$(location_of "$hdr"); ct="${loc#*ct=}"
  hdr=$(curl -s --max-time 60 -D - -o /dev/null -b "$COOKIES" -H "Origin: $BASE" -H "x-forwarded-for: $1" \
    --data-urlencode "consent_token=$ct" -d "decision=continue" "$BASE/api/oauth/authorize")
  loc=$(location_of "$hdr")
  CODE2=$(printf '%s' "$loc" | sed -n 's/.*[?&]code=\([^&]*\).*/\1/p')
}

new_code "10.60.3.1"
TOK=$(token_req "$CODE2" "$(hex 32)" "10.60.3.2" "" "" "")
[[ "$TOK" == *'"invalid_grant"'* ]]; assert "F1 wrong PKCE verifier → invalid_grant" $?

new_code "10.60.3.3"
TOK=$(token_req "$CODE2" "$VERIFIER" "10.60.3.4" "" "https://verify.midman.bd/other" "")
[[ "$TOK" == *'"invalid_grant"'* ]]; assert "F2a redirect_uri mismatch at token → invalid_grant" $?
TOK=$(token_req "$CODE2" "$VERIFIER" "10.60.3.5" "" "" "")
[[ "$TOK" == *'"invalid_grant"'* ]]; assert "F2b code burned after mismatch (single-use)" $?

new_code "10.60.3.6"
TOK=$(token_req "$CODE2" "$VERIFIER" "10.60.3.7" "wrong-secret-wrong-secret" "" "")
[[ "$TOK" == *'"invalid_client"'* ]]; assert "F3 wrong client_secret → invalid_client" $?

TOK=$(token_req "$(hex 16)" "$VERIFIER" "10.60.3.8" "" "" "client_credentials")
[[ "$TOK" == *'"unsupported_grant_type"'* ]]; assert "F4 wrong grant_type rejected" $?

new_code "10.60.3.9"
bun scripts/task60-helpers.ts expire-codes >/dev/null
TOK=$(token_req "$CODE2" "$VERIFIER" "10.60.3.10" "" "" "")
[[ "$TOK" == *'"invalid_grant"'* ]]; assert "F5 expired code → invalid_grant" $?

# ════════════════ G. consent POST CSRF guards ════════════════
echo "▶ G. consent POST CSRF guards"
make_pkce; STATE="st_$(hex 8)"
AUTH_URL="$BASE/oauth/authorize?client_id=midman-verify&redirect_uri=https%3A%2F%2Fverify.midman.bd%2Fauth%2Fcallback&response_type=code&scope=openid&state=$STATE&code_challenge=$CHALLENGE&code_challenge_method=S256"
HDR=$(curl -s --max-time 60 -D - -o /dev/null -b "$COOKIES" "$AUTH_URL")
LOC=$(location_of "$HDR"); CT="${LOC#*ct=}"

S=$(curl -s --max-time 60 -o /dev/null -w '%{http_code}' -b "$COOKIES" \
  --data-urlencode "consent_token=$CT" -d "decision=continue" "$BASE/api/oauth/authorize")
[ "$S" = "403" ]; assert "G1 missing Origin → 403" $? "$S"

S=$(curl -s --max-time 60 -o /dev/null -w '%{http_code}' -b "$COOKIES" -H "Origin: https://evil.example.com" \
  --data-urlencode "consent_token=$CT" -d "decision=continue" "$BASE/api/oauth/authorize")
[ "$S" = "403" ]; assert "G2 cross-origin Origin → 403" $? "$S"

S=$(curl -s --max-time 60 -o /dev/null -w '%{http_code}' -b "$COOKIES" -H "Origin: $BASE" \
  --data-urlencode "consent_token=${CT}x" -d "decision=continue" "$BASE/api/oauth/authorize")
[ "$S" = "403" ]; assert "G3 tampered consent_token → 403" $? "$S"

S=$(curl -s --max-time 60 -o /dev/null -w '%{http_code}' -b "$COOKIES" -H "Origin: $BASE" \
  --data-urlencode "consent_token=$CT" "$BASE/api/oauth/authorize")
[ "$S" = "400" ]; assert "G4 missing decision → 400" $? "$S"

# ════════════════ H. consent page guard ════════════════
echo "▶ H. consent page guard"
H=$(curl -s --max-time 60 "$BASE/oauth/consent")
[[ "$H" != *"/api/oauth/authorize"* ]]; assert "H1 no ct → no consent form rendered" $?
H=$(curl -s --max-time 60 "$BASE/oauth/consent?ct=garbage.token.value")
[[ "$H" != *"/api/oauth/authorize"* ]]; assert "H2 garbage ct → no consent form rendered" $?

# ── teardown ──
bun scripts/task60-helpers.ts cleanup >/dev/null 2>&1 || true
kill $SERVER_PID 2>/dev/null
pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null
sleep 1
cd "$ROOT" && git checkout -- db/custom.db 2>/dev/null

echo "──────────────────────────────"
echo "RESULT: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] || tail -30 "$LOG"
exit $FAIL
