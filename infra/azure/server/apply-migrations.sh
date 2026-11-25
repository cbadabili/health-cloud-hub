#!/usr/bin/env bash
# Apply supabase/migrations/*.sql to the self-hosted database, in filename order.
#
# Usage: apply-migrations.sh <stack-dir> <migrations-dir>
#   <stack-dir>       folder holding docker-compose.yml and .env (Supabase's docker/ folder)
#   <migrations-dir>  folder holding the *.sql migration files
#
# - Runs psql inside the database container as the `postgres` role, the same
#   role Supabase's SQL editor uses, so migrations behave as they did there.
# - Records each applied file (name + SHA-256) in ops.applied_migrations and
#   skips it next time. A file whose contents changed after it was applied is
#   reported, never silently re-run.
# - 20250711070631-…sql is known to fail partway on a fresh database (see
#   scripts/test-db.sh), so it's applied without stopping on errors.
set -euo pipefail

STACK_DIR=${1:?stack dir}
MIGRATIONS_DIR=${2:?migrations dir}
LENIENT_PATTERN='^20250711070631-'

cd "$STACK_DIR"

psql_db() {
  docker compose exec -T -e PGOPTIONS="-c client_min_messages=warning" db psql -U postgres -d postgres -X -q "$@"
}

psql_db -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS ops;
REVOKE ALL ON SCHEMA ops FROM PUBLIC;
CREATE TABLE IF NOT EXISTS ops.applied_migrations (
  filename TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

applied=0
skipped=0
changed=0
shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "No migrations found in $MIGRATIONS_DIR" >&2
  exit 1
fi

# Filenames are sorted by the shell glob (C locale order matches the timestamps).
for file in "${files[@]}"; do
  name=$(basename "$file")
  sum=$(sha256sum "$file" | cut -d' ' -f1)
  recorded=$(psql_db -At -v name="$name" <<'SQL'
SELECT sha256 FROM ops.applied_migrations WHERE filename = :'name';
SQL
)
  if [ -n "$recorded" ]; then
    if [ "$recorded" != "$sum" ]; then
      echo "WARNING: $name changed after it was applied (recorded $recorded, now $sum). Not re-running." >&2
      changed=$((changed + 1))
    fi
    skipped=$((skipped + 1))
    continue
  fi

  echo "Applying $name"
  if [[ "$name" =~ $LENIENT_PATTERN ]]; then
    psql_db -v ON_ERROR_STOP=0 < "$file" > /dev/null 2>&1 || true
  else
    psql_db -v ON_ERROR_STOP=1 < "$file" > /dev/null
  fi
  psql_db -v ON_ERROR_STOP=1 -v name="$name" -v sum="$sum" <<'SQL'
INSERT INTO ops.applied_migrations (filename, sha256) VALUES (:'name', :'sum');
SQL
  applied=$((applied + 1))
done

echo "Migrations: $applied applied, $skipped already applied, $changed changed since applying."
if [ "$changed" -gt 0 ]; then
  exit 2
fi
