#!/usr/bin/env bash
# Restore drill: prove last night's backup can be restored, and time it.
#
# Restores a database dump into a temporary database on the same server
# (the live database is not touched), compares it with the live data,
# then drops the temporary copy. Run before the pilot and then quarterly;
# keep the printed result as evidence.
#
# Usage: restore-drill.sh [dump-file]
#   Without a file: downloads the newest dump for ENV_NAME from Azure Blob
#   Storage (needs STORAGE_ACCOUNT), or uses the newest local one with UPLOAD=skip.
# Settings: STACK_DIR, ENV_NAME, STORAGE_ACCOUNT, BACKUP_DIR (as in backup.sh)
set -euo pipefail

STACK_DIR=${STACK_DIR:?STACK_DIR is required}
ENV_NAME=${ENV_NAME:?ENV_NAME is required}
BACKUP_DIR=${BACKUP_DIR:-$(cd "$STACK_DIR/../.." && pwd)/backups}
UPLOAD=${UPLOAD:-yes}
DUMP=${1:-}
DRILL_DB=restore_drill_$(date -u +%Y%m%d%H%M%S)
started=$(date +%s)

if [ -z "$DUMP" ]; then
  if [ "$UPLOAD" = "skip" ]; then
    DUMP=$(find "$BACKUP_DIR" -maxdepth 1 -name 'postgres-*.dump' | sort | tail -n1)
  else
    STORAGE_ACCOUNT=${STORAGE_ACCOUNT:?STORAGE_ACCOUNT is required}
    az account show > /dev/null 2>&1 || az login --identity --output none
    latest=$(az storage blob list --auth-mode login --only-show-errors \
      --account-name "$STORAGE_ACCOUNT" --container-name db-backups --prefix "$ENV_NAME/" \
      --query "sort_by([?ends_with(name, '.dump')], &properties.lastModified)[-1].name" --output tsv)
    [ -n "$latest" ] || { echo "No backups found for $ENV_NAME." >&2; exit 1; }
    DUMP="$BACKUP_DIR/drill-$(basename "$latest")"
    mkdir -p "$BACKUP_DIR"
    az storage blob download --auth-mode login --only-show-errors --output none \
      --account-name "$STORAGE_ACCOUNT" --container-name db-backups --name "$latest" --file "$DUMP"
    echo "Downloaded $latest"
  fi
fi
[ -f "$DUMP" ] || { echo "Dump not found: $DUMP" >&2; exit 1; }
echo "Restoring $(basename "$DUMP") into temporary database $DRILL_DB"

cd "$STACK_DIR"
sql() { docker compose exec -T db psql -U supabase_admin -X -At -v ON_ERROR_STOP=1 "$@"; }
cleanup() { sql -d postgres -c "DROP DATABASE IF EXISTS $DRILL_DB" > /dev/null 2>&1 || true; }
trap cleanup EXIT

sql -d postgres -c "CREATE DATABASE $DRILL_DB" > /dev/null
# Some Supabase-internal objects (e.g. publications, event triggers) already
# exist per server and report harmless errors; data errors are caught by the
# comparison below.
restore_log=$(docker compose exec -T db pg_restore -U supabase_admin -d "$DRILL_DB" --no-owner --role=supabase_admin < "$DUMP" 2>&1 || true)
restore_errors=$(grep -c '^pg_restore: error' <<<"$restore_log" || true)

failures=0
compare() {
  local label=$1 query=$2 live drill
  live=$(sql -d postgres -c "$query")
  drill=$(sql -d "$DRILL_DB" -c "$query")
  if [ "$live" = "$drill" ]; then
    echo "  ok   - $label: $live"
  else
    echo "  FAIL - $label: live $live, restored $drill"
    failures=$((failures + 1))
  fi
}
compare "sign-in accounts"    "SELECT count(*) FROM auth.users"
compare "practices"           "SELECT count(*) FROM public.practices"
compare "patients"            "SELECT count(*) FROM public.patients"
compare "appointments"        "SELECT count(*) FROM public.appointments"
compare "clinical notes"      "SELECT count(*) FROM public.medical_records"
compare "invoices"            "SELECT count(*) FROM public.invoices"
compare "audit log entries"   "SELECT count(*) FROM public.audit_events"
compare "uploaded file records" "SELECT count(*) FROM storage.objects"
compare "applied migrations"  "SELECT count(*) FROM ops.applied_migrations"
compare "tables with row-level security" "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity"

elapsed=$(( $(date +%s) - started ))
echo
echo "Restore drill for $ENV_NAME on $(date -u +%Y-%m-%d): $( [ $failures -eq 0 ] && echo PASSED || echo FAILED ) in ${elapsed}s"
echo "Backup file: $(basename "$DUMP"); pg_restore reported $restore_errors non-fatal error(s)."
if [ "$restore_errors" -gt 0 ]; then
  grep '^pg_restore: error' <<<"$restore_log" | sort | uniq -c | sort -rn | head -n 10
fi
[ "$failures" -eq 0 ]
