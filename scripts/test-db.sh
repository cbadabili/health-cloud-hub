#!/usr/bin/env bash
# Database tests: applies every migration to a scratch Postgres database and runs
# the tests in supabase/tests/.
#
# Needs a Postgres 15+ server where you can create databases, configured with the
# usual libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD). The user must be a
# superuser (the tests switch roles to simulate Supabase's anon/authenticated).
#
#   scripts/test-db.sh                 # run everything
#   scripts/test-db.sh booking         # only test files whose name contains "booking"
#
# Each *.test.sql file runs in its own copy of the migrated database. Tests print
# "ok - ..." for each passing check and stop at the first "not ok".
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"
TESTS="$ROOT/supabase/tests"
TEMPLATE="cch_test_template"
FILTER="${1:-}"

# This migration has a syntax error ("CREATE TYPE IF NOT EXISTS") and the next one
# redoes its work. It is applied leniently, as it presumably was in production.
KNOWN_BROKEN=("20250711070631-0885e4ca-c178-4d5b-aece-b6119cde3bc0.sql")

psql_strict() { psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse "$@"; }
is_known_broken() { local f; for f in "${KNOWN_BROKEN[@]}"; do [[ "$1" == "$f" ]] && return 0; done; return 1; }

echo "== Building template database"
dropdb --if-exists -f "$TEMPLATE" >/dev/null 2>&1 || dropdb --if-exists "$TEMPLATE"
createdb "$TEMPLATE"
psql_strict -d "$TEMPLATE" -f "$TESTS/setup/00_supabase_stubs.sql"

for migration in $(ls "$MIGRATIONS"/*.sql | sort); do
  name="$(basename "$migration")"
  if is_known_broken "$name"; then
    echo "   (lenient) $name"
    psql -X -q -v VERBOSITY=terse -d "$TEMPLATE" -f "$migration" >/dev/null 2>&1 || true
  else
    echo "   $name"
    psql_strict -d "$TEMPLATE" -f "$migration" 2>&1 | { grep -v "NOTICE" || true; }
  fi
done
psql_strict -d "$TEMPLATE" -f "$TESTS/setup/10_test_helpers.sql"

passed=0
failed_files=()

run_file() {
  local label="$1" db="$2" cmd=("${@:3}")
  local output status
  set +e
  output="$("${cmd[@]}" 2>&1)"
  status=$?
  set -e
  local oks
  # Passing checks are "NOTICE:  ok - ..." (SQL) or a line starting "ok - " (scripts).
  oks="$(printf '%s\n' "$output" | grep -E '(NOTICE: +|^)ok - ' | sed -E 's/^.*NOTICE: +//' || true)"
  if [[ -n "$oks" ]]; then
    printf '%s\n' "$oks" | sed 's/^/   ✓ /'
    passed=$((passed + $(printf '%s\n' "$oks" | wc -l)))
  fi
  if [[ $status -ne 0 ]]; then
    printf '%s\n' "$output" | grep -E 'not ok|ERROR|FATAL' | sed 's/^/   ✗ /' | head -5
    failed_files+=("$label")
  fi
}

for test_file in $(ls "$TESTS"/*.test.sql 2>/dev/null | sort); do
  name="$(basename "$test_file" .test.sql)"
  [[ -n "$FILTER" && "$name" != *"$FILTER"* ]] && continue
  db="cch_test_${name//[^a-z0-9_]/_}"
  echo "== $name"
  dropdb --if-exists "$db" >/dev/null 2>&1 || true
  createdb -T "$TEMPLATE" "$db"
  run_file "$name" "$db" psql_strict -d "$db" -f "$test_file"
  dropdb "$db"
done

# Concurrency tests need several sessions at once, so they're shell scripts that
# receive a fresh database name as $1.
for test_script in $(ls "$TESTS"/concurrency/*.sh 2>/dev/null | sort); do
  name="$(basename "$test_script" .sh)"
  [[ -n "$FILTER" && "$name" != *"$FILTER"* ]] && continue
  db="cch_test_${name//[^a-z0-9_]/_}"
  echo "== $name (concurrency)"
  dropdb --if-exists "$db" >/dev/null 2>&1 || true
  createdb -T "$TEMPLATE" "$db"
  run_file "$name" "$db" bash "$test_script" "$db"
  dropdb "$db"
done

dropdb "$TEMPLATE"
echo
if [[ ${#failed_files[@]} -gt 0 ]]; then
  echo "FAILED: ${failed_files[*]} ($passed checks passed before stopping)"
  exit 1
fi
echo "All $passed checks passed."
