#!/usr/bin/env bash
# Nightly backup: the whole database plus uploaded files, copied to Azure Blob Storage.
#
# Run by the clinithetics-backup.timer systemd unit that setup-server.sh installs.
# Settings (environment variables):
#   STACK_DIR        Supabase docker/ folder (has docker-compose.yml and .env)
#   STORAGE_ACCOUNT  storage account holding the db-backups container
#   ENV_NAME         prod | staging (used as the folder name in the container)
#   BACKUP_DIR       local folder for backup files (default: <data disk>/backups)
#   KEEP_LOCAL_DAYS  local copies to keep (default 3); Azure keeps 35 days
#   UPLOAD           set to "skip" to keep the backup local only (testing)
#
# The database is dumped as `supabase_admin` (superuser) so Supabase's own
# schemas (auth, storage) are included, not just ours.
set -euo pipefail

STACK_DIR=${STACK_DIR:?STACK_DIR is required}
ENV_NAME=${ENV_NAME:?ENV_NAME is required}
UPLOAD=${UPLOAD:-yes}
KEEP_LOCAL_DAYS=${KEEP_LOCAL_DAYS:-3}
BACKUP_DIR=${BACKUP_DIR:-$(cd "$STACK_DIR/../.." && pwd)/backups}
CONTAINER=db-backups

# Azure Monitor watches syslog for these lines; no "backup ok" in 26 hours raises an alert.
heartbeat() { command -v logger >/dev/null && logger -t clinithetics-backup "clinithetics-backup: $*" || true; }
trap 'heartbeat "backup FAILED (line $LINENO)"' ERR

stamp=$(date -u +%Y%m%dT%H%M%SZ)
day_path=$(date -u +%Y/%m/%d)
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
db_file="$BACKUP_DIR/postgres-$stamp.dump"
files_file="$BACKUP_DIR/storage-files-$stamp.tar.gz"

cd "$STACK_DIR"
echo "Dumping the database"
docker compose exec -T db pg_dump -U supabase_admin -d postgres --format=custom --compress=6 > "$db_file.partial"
mv "$db_file.partial" "$db_file"

echo "Checking the dump can be read"
docker compose exec -T db pg_restore --list < "$db_file" > /dev/null

echo "Archiving uploaded files"
tar -C "$STACK_DIR/volumes" -czf "$files_file" storage

sha256sum "$db_file" "$files_file" > "$BACKUP_DIR/SHA256SUMS-$stamp"
chmod 600 "$db_file" "$files_file" "$BACKUP_DIR/SHA256SUMS-$stamp"
echo "Backup written: $(du -h "$db_file" | cut -f1) database, $(du -h "$files_file" | cut -f1) files"

if [ "$UPLOAD" != "skip" ]; then
  STORAGE_ACCOUNT=${STORAGE_ACCOUNT:?STORAGE_ACCOUNT is required}
  az account show > /dev/null 2>&1 || az login --identity --output none
  for f in "$db_file" "$files_file" "$BACKUP_DIR/SHA256SUMS-$stamp"; do
    az storage blob upload --auth-mode login --only-show-errors --output none \
      --account-name "$STORAGE_ACCOUNT" --container-name "$CONTAINER" \
      --name "$ENV_NAME/$day_path/$(basename "$f")" --file "$f"
  done
  echo "Uploaded to $STORAGE_ACCOUNT/$CONTAINER/$ENV_NAME/$day_path/"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f -mtime +"$KEEP_LOCAL_DAYS" -delete
if [ "$UPLOAD" != "skip" ]; then
  heartbeat "backup ok ($ENV_NAME, $stamp)"
fi
echo "Backup finished."
