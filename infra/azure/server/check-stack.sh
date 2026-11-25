#!/usr/bin/env bash
# shellcheck disable=SC2015  # `cond && pass || fail` is safe: pass only echoes, so it never fails.
# Check that a Clinithetics Supabase stack is up and locked down.
#
# Usage: check-stack.sh <stack-dir>
#   PUBLIC_URL (optional): also check the public entry point, e.g.
#   https://api.clinithetics.beedab.com once DNS and the certificate are in place.
#
# Exits non-zero if any check fails.
set -uo pipefail

STACK_DIR=${1:?stack dir}
PUBLIC_URL=${PUBLIC_URL:-}
cd "$STACK_DIR" || exit 1

env_value() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2-; }
ANON_KEY=$(env_value ANON_KEY)
GW="http://127.0.0.1:$(env_value API_GW_HTTP_PORT || true)"
[ "$GW" = "http://127.0.0.1:" ] && GW=http://127.0.0.1:8000

failures=0
pass() { echo "  ok   - $*"; }
fail() { echo "  FAIL - $*"; failures=$((failures + 1)); }

status_of() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "Gateway checks ($GW)"
code=$(status_of -H "apikey: $ANON_KEY" "$GW/auth/v1/health")
[ "$code" = 200 ] && pass "auth service answers" || fail "auth health returned $code"

for table in patients appointments medical_records audit_events staff_memberships; do
  body=$(curl -s -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" "$GW/rest/v1/$table?select=id&limit=1")
  case "$body" in
    "[]"|*'"code":"42501"'*|*"permission denied"*) pass "anonymous visitors can't read $table" ;;
    *) fail "anonymous read of $table returned: ${body:0:120}" ;;
  esac
done

echo "Database checks"
psql_db() { docker compose exec -T db psql -U postgres -d postgres -X -At -c "$1" 2>/dev/null; }
[ "$(psql_db "SELECT to_regprocedure('public.my_practices()') IS NOT NULL")" = t ] \
  && pass "practice functions installed" || fail "public.my_practices() is missing"
[ "$(psql_db "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity AND tablename NOT LIKE 'pg_%'")" = 0 ] \
  && pass "row-level security on every public table" \
  || fail "public tables without row-level security: $(psql_db "SELECT string_agg(tablename, ', ') FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity")"
applied=$(psql_db "SELECT count(*) FROM ops.applied_migrations")
[ -n "$applied" ] && [ "$applied" -gt 0 ] && pass "$applied migrations recorded" || fail "no migrations recorded"

echo "Auth settings"
auth_env=$(docker exec supabase-auth env 2>/dev/null)
grep -qx 'GOTRUE_MFA_TOTP_ENROLL_ENABLED=true' <<<"$auth_env" && grep -qx 'GOTRUE_MFA_TOTP_VERIFY_ENABLED=true' <<<"$auth_env" \
  && pass "two-step sign-in (TOTP) enabled" || fail "TOTP MFA is not enabled in the auth service"
grep -qx 'GOTRUE_MAILER_AUTOCONFIRM=true' <<<"$auth_env" \
  && echo "  note - email confirmation is OFF (local testing only)" || pass "email confirmation required"

echo "Containers"
sleep "${SETTLE_SECONDS:-15}"
not_running=$(docker compose ps --all --format '{{.Name}} {{.State}}' | grep -v ' running$' || true)
[ -z "$not_running" ] && pass "every container is running" || fail "not running: $(tr '\n' ';' <<<"$not_running")"
restarts=$(docker compose ps --all -q | xargs -r docker inspect -f '{{.Name}} {{.RestartCount}}' | awk '$2 > 0' || true)
[ -z "$restarts" ] && pass "no container has restarted" || fail "restart loops: $(tr '\n' ';' <<<"$restarts")"

echo "Network exposure"
exposed=$(docker ps --format '{{.Names}} {{.Ports}}' | grep -E '(0\.0\.0\.0|\[::\]|:::)[0-9]*:' | grep -v '^clinithetics-caddy ' || true)
[ -z "$exposed" ] && pass "only Caddy listens on public interfaces" || fail "exposed on all interfaces: $exposed"

if [ -n "$PUBLIC_URL" ]; then
  echo "Public entry point ($PUBLIC_URL)"
  code=$(status_of -H "apikey: $ANON_KEY" "$PUBLIC_URL/auth/v1/health")
  [ "$code" = 200 ] && pass "auth reachable through Caddy" || fail "public auth health returned $code"
  for path in / /pg/tables /functions/v1/ /analytics/v1/ /project/default; do
    code=$(status_of "$PUBLIC_URL$path")
    [ "$code" = 404 ] && pass "$path is not public" || fail "$path returned $code (should be 404)"
  done
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed."
  exit 1
fi
echo "All checks passed."
