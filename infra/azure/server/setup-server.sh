#!/usr/bin/env bash
# Install or update the self-hosted Supabase stack for Clinithetics on this server.
#
# Safe to run again: secrets are generated once and reused, migrations already
# applied are skipped. Normally started from Azure Cloud Shell by
# infra/azure/deploy.sh (through `az vm run-command`), but it can be run by hand:
#
#   sudo ENV_NAME=prod API_HOSTNAME=api.clinithetics.beedab.com \
#        APP_URL=https://clinithetics.beedab.com ACME_EMAIL=ops@example.com \
#        KEY_VAULT_NAME=kv-... STORAGE_ACCOUNT=st... \
#        ./setup-server.sh
#
# Settings (environment variables):
#   ENV_NAME          prod | staging | local
#   API_HOSTNAME      public API host name (TLS certificate is issued for it)
#   APP_URL           the web app's URL, used in sign-up and invitation emails
#   EXTRA_REDIRECTS   optional, comma-separated extra allowed redirect URLs
#   ACME_EMAIL        email for Let's Encrypt expiry notices
#   KEY_VAULT_NAME    Azure Key Vault holding the secrets (SECRET_BACKEND=keyvault)
#   STORAGE_ACCOUNT   storage account for backups (enables the nightly backup timer)
#   SECRET_BACKEND    keyvault (default) | file (local testing only)
#   SECRETS_FILE      with SECRET_BACKEND=file: where secrets are kept
#   STACK_ROOT        default /srv/supabase (the data disk)
#   APP_BUNDLE_DIR    folder with migrations/ and server/ from this repo
#                     (default: the repo this script sits in)
#   SUPABASE_REF      Supabase git commit for the docker/ folder (pinned below)
#   CADDY_SITE        what Caddy serves; defaults to API_HOSTNAME.
#                     Local testing uses ":80" (plain HTTP, no certificate).
#   CADDY_HTTP_PORT / CADDY_HTTPS_PORT   host ports for Caddy (default 80/443)
#   EMAIL_AUTOCONFIRM true only for local testing without an email service
set -euo pipefail

# Supabase's docker/ folder at a fixed commit. Upgrade deliberately: test the
# new commit on staging first, then change it here.
DEFAULT_SUPABASE_REF=b2cd26e0546f801946226a1096b49d4a04ab586c

ENV_NAME=${ENV_NAME:?ENV_NAME is required (prod, staging or local)}
API_HOSTNAME=${API_HOSTNAME:?API_HOSTNAME is required}
APP_URL=${APP_URL:?APP_URL is required}
EXTRA_REDIRECTS=${EXTRA_REDIRECTS:-}
ACME_EMAIL=${ACME_EMAIL:-}
SECRET_BACKEND=${SECRET_BACKEND:-keyvault}
STACK_ROOT=${STACK_ROOT:-/srv/supabase}
SUPABASE_REF=${SUPABASE_REF:-$DEFAULT_SUPABASE_REF}
CADDY_SITE=${CADDY_SITE:-$API_HOSTNAME}
CADDY_HTTP_PORT=${CADDY_HTTP_PORT:-80}
CADDY_HTTPS_PORT=${CADDY_HTTPS_PORT:-443}
EMAIL_AUTOCONFIRM=${EMAIL_AUTOCONFIRM:-false}
STORAGE_ACCOUNT=${STORAGE_ACCOUNT:-}

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_BUNDLE_DIR=${APP_BUNDLE_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}
MIGRATIONS_DIR=$APP_BUNDLE_DIR/supabase/migrations
SERVER_DIR=$APP_BUNDLE_DIR/infra/azure/server
UPSTREAM_DIR=$STACK_ROOT/upstream
STACK_DIR=$UPSTREAM_DIR/docker

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[ "$EMAIL_AUTOCONFIRM" = "true" ] && [ "$ENV_NAME" = "prod" ] && die "EMAIL_AUTOCONFIRM must not be used in production."
case "$CADDY_SITE" in
  :*) ACME_EMAIL=${ACME_EMAIL:-noreply@example.invalid} ;;  # plain HTTP for local testing; no certificate
  *) [ -n "$ACME_EMAIL" ] || die "ACME_EMAIL is required so Let's Encrypt can warn about certificate problems." ;;
esac
[ -d "$MIGRATIONS_DIR" ] || die "No migrations at $MIGRATIONS_DIR (set APP_BUNDLE_DIR)."
for cmd in docker git openssl sha256sum curl; do
  command -v "$cmd" >/dev/null || die "$cmd is not installed."
done
docker compose version >/dev/null || die "Docker Compose plugin is not installed."

# --- Secrets -----------------------------------------------------------------
# Names in .env style (JWT_SECRET); Key Vault names use dashes (jwt-secret).
kv_name() { printf '%s' "$1" | tr '[:upper:]_' '[:lower:]-'; }

case "$SECRET_BACKEND" in
  keyvault)
    KEY_VAULT_NAME=${KEY_VAULT_NAME:?KEY_VAULT_NAME is required}
    command -v az >/dev/null || die "Azure CLI is not installed."
    az account show >/dev/null 2>&1 || az login --identity --output none \
      || die "Could not sign in with the VM's managed identity."
    secret_get() {
      az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "$(kv_name "$1")" \
        --query value --output tsv 2>/dev/null || true
    }
    secret_set() {
      az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "$(kv_name "$1")" \
        --value "$2" --output none
    }
    ;;
  file)
    [ "$ENV_NAME" = "prod" ] && die "SECRET_BACKEND=file is for local testing only."
    SECRETS_FILE=${SECRETS_FILE:-$STACK_ROOT/secrets.env}
    mkdir -p "$(dirname "$SECRETS_FILE")"
    touch "$SECRETS_FILE"
    chmod 600 "$SECRETS_FILE"
    secret_get() { grep -E "^$1=" "$SECRETS_FILE" | tail -n1 | cut -d= -f2- || true; }
    secret_set() { printf '%s=%s\n' "$1" "$2" >> "$SECRETS_FILE"; }
    ;;
  *) die "SECRET_BACKEND must be keyvault or file." ;;
esac

# --- Supabase's docker files at the pinned commit --------------------------------
log "Fetching Supabase docker files at $SUPABASE_REF"
mkdir -p "$STACK_ROOT"
if [ ! -d "$UPSTREAM_DIR/.git" ]; then
  git clone --quiet --filter=blob:none --no-checkout https://github.com/supabase/supabase "$UPSTREAM_DIR"
  git -C "$UPSTREAM_DIR" sparse-checkout set docker
fi
current_ref=$(git -C "$UPSTREAM_DIR" rev-parse HEAD 2>/dev/null || echo none)
if [ "$current_ref" != "$SUPABASE_REF" ] || [ ! -f "$STACK_DIR/docker-compose.yml" ]; then
  git -C "$UPSTREAM_DIR" fetch --quiet --filter=blob:none origin "$SUPABASE_REF"
  git -C "$UPSTREAM_DIR" checkout --quiet "$SUPABASE_REF"
  [ "$current_ref" != none ] && [ "$current_ref" != "$SUPABASE_REF" ] && echo "Upgraded Supabase docker files from $current_ref to $SUPABASE_REF."
fi
[ -f "$STACK_DIR/docker-compose.yml" ] || die "Supabase docker files missing at $STACK_DIR."
grep -q 'GOTRUE_MFA_TOTP_ENROLL_ENABLED' "$STACK_DIR/docker-compose.yml" \
  || die "This Supabase version no longer mentions GOTRUE_MFA_TOTP_ENROLL_ENABLED. Check how two-step sign-in is configured before continuing."

# --- Generate secrets once ------------------------------------------------------
GENERATED_KEYS=(JWT_SECRET ANON_KEY SERVICE_ROLE_KEY SECRET_KEY_BASE REALTIME_DB_ENC_KEY
  VAULT_ENC_KEY PG_META_CRYPTO_KEY LOGFLARE_PUBLIC_ACCESS_TOKEN LOGFLARE_PRIVATE_ACCESS_TOKEN
  S3_PROTOCOL_ACCESS_KEY_ID S3_PROTOCOL_ACCESS_KEY_SECRET MINIO_ROOT_PASSWORD
  POSTGRES_PASSWORD DASHBOARD_PASSWORD)

declare -A SECRET
if [ -z "$(secret_get JWT_SECRET)" ]; then
  log "Generating new secrets (first run)"
  generated=$(sh "$STACK_DIR/utils/generate-keys.sh" < /dev/null)
  for key in "${GENERATED_KEYS[@]}"; do
    value=$(printf '%s\n' "$generated" | grep -E "^$key=" | head -n1 | cut -d= -f2-)
    [ -n "$value" ] || die "Supabase's generate-keys.sh did not produce $key."
    secret_set "$key" "$value"
  done
  secret_set POOLER_TENANT_ID "clinithetics-$ENV_NAME"
else
  log "Reusing existing secrets"
fi
for key in "${GENERATED_KEYS[@]}" POOLER_TENANT_ID; do
  SECRET[$key]=$(secret_get "$key")
  [ -n "${SECRET[$key]}" ] || die "Secret $key is missing from the secret store."
done

SMTP_HOST=$(secret_get SMTP_HOST)
SMTP_USER=$(secret_get SMTP_USER)
SMTP_PASS=$(secret_get SMTP_PASS)
SMTP_SENDER=$(secret_get SMTP_SENDER)

# --- .env ------------------------------------------------------------------------
log "Writing $STACK_DIR/.env"
ENV_FILE=$STACK_DIR/.env
tmp_env=$(mktemp)
cp "$STACK_DIR/.env.example" "$tmp_env"

set_env() {
  local key=$1 value=$2
  if grep -qE "^$key=" "$tmp_env"; then
    KEY="$key" VALUE="$value" awk 'BEGIN{k=ENVIRON["KEY"]; v=ENVIRON["VALUE"]}
      index($0, k "=") == 1 { print k "=" v; next } { print }' "$tmp_env" > "$tmp_env.new"
    mv "$tmp_env.new" "$tmp_env"
  else
    printf '%s=%s\n' "$key" "$value" >> "$tmp_env"
  fi
}

for key in "${GENERATED_KEYS[@]}" POOLER_TENANT_ID; do
  set_env "$key" "${SECRET[$key]}"
done

redirects="$APP_URL/**"
[ -n "$EXTRA_REDIRECTS" ] && redirects="$redirects,$EXTRA_REDIRECTS"

compose_files="docker-compose.yml:docker-compose.clinithetics.yml"
# Testing hook: an extra Compose file layered last (never used on Azure).
if [ -n "${EXTRA_COMPOSE_FILE:-}" ]; then
  install -m 644 "$EXTRA_COMPOSE_FILE" "$STACK_DIR/docker-compose.extra.yml"
  compose_files="$compose_files:docker-compose.extra.yml"
fi
set_env COMPOSE_FILE "$compose_files"
set_env SITE_URL "$APP_URL"
set_env ADDITIONAL_REDIRECT_URLS "$redirects"
set_env SUPABASE_PUBLIC_URL "https://$API_HOSTNAME"
set_env API_EXTERNAL_URL "https://$API_HOSTNAME/auth/v1"
set_env DISABLE_SIGNUP false
set_env ENABLE_EMAIL_SIGNUP true
set_env ENABLE_EMAIL_AUTOCONFIRM "$EMAIL_AUTOCONFIRM"
set_env ENABLE_PHONE_SIGNUP false
set_env ENABLE_PHONE_AUTOCONFIRM false
set_env ENABLE_ANONYMOUS_USERS false
set_env OPENAI_API_KEY ""
set_env STUDIO_DEFAULT_ORGANIZATION "Clinithetics"
set_env STUDIO_DEFAULT_PROJECT "clinithetics-$ENV_NAME"
set_env CADDY_SITE "$CADDY_SITE"
set_env ACME_EMAIL "$ACME_EMAIL"
set_env CADDY_HTTP_PORT "$CADDY_HTTP_PORT"
set_env CADDY_HTTPS_PORT "$CADDY_HTTPS_PORT"

if [ -n "$SMTP_HOST" ] && [ -n "$SMTP_USER" ] && [ -n "$SMTP_PASS" ] && [ -n "$SMTP_SENDER" ]; then
  set_env SMTP_HOST "$SMTP_HOST"
  set_env SMTP_PORT 587
  set_env SMTP_USER "$SMTP_USER"
  set_env SMTP_PASS "$SMTP_PASS"
  set_env SMTP_ADMIN_EMAIL "$SMTP_SENDER"
  set_env SMTP_SENDER_NAME "Clinithetics"
  smtp_ready=yes
else
  smtp_ready=no
fi

install -m 600 "$tmp_env" "$ENV_FILE"
rm -f "$tmp_env"
install -m 644 "$SERVER_DIR/docker-compose.clinithetics.yml" "$STACK_DIR/docker-compose.clinithetics.yml"
install -m 644 "$SERVER_DIR/Caddyfile" "$STACK_DIR/Caddyfile"
mkdir -p "$STACK_DIR/volumes/caddy/data" "$STACK_DIR/volumes/caddy/config"

# --- Start ------------------------------------------------------------------------
cd "$STACK_DIR"
log "Checking the combined Compose configuration"
docker compose config --quiet

log "Downloading images that aren't here yet (first run takes several minutes)"
# Image versions are pinned in the Compose files, so only missing ones are fetched.
for attempt in 1 2 3; do
  if docker compose pull --quiet --policy missing; then
    break
  fi
  [ "$attempt" = 3 ] && die "Could not download the container images (registry rate limit or network). Try again in a few minutes."
  echo "Download failed (attempt $attempt); retrying in $((attempt * 30)) seconds."
  sleep $((attempt * 30))
done

log "Starting the stack"
docker compose up -d --remove-orphans

log "Waiting for services to report healthy"
wait_healthy() {
  local name=$1 tries=0
  while [ $tries -lt 90 ]; do
    status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$name" 2>/dev/null || echo missing)
    case "$status" in
      healthy|running) echo "  $name: $status"; return 0 ;;
    esac
    tries=$((tries + 1))
    sleep 5
  done
  docker compose logs --tail 50 >&2 || true
  die "$name did not become healthy (last status: $status)."
}
for c in supabase-db supabase-auth supabase-rest supabase-storage supabase-envoy clinithetics-caddy; do
  wait_healthy "$c"
done

# --- Database ----------------------------------------------------------------------
log "Applying Clinithetics migrations"
bash "$SERVER_DIR/apply-migrations.sh" "$STACK_DIR" "$MIGRATIONS_DIR"

# --- Checks ------------------------------------------------------------------------
log "Checking the stack"
bash "$SERVER_DIR/check-stack.sh" "$STACK_DIR"

# --- Backups ------------------------------------------------------------------------
if [ -n "$STORAGE_ACCOUNT" ] && command -v systemctl >/dev/null; then
  log "Installing the nightly backup timer"
  cat > /etc/systemd/system/clinithetics-backup.service <<UNIT
[Unit]
Description=Clinithetics nightly database and file backup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
Environment=STACK_DIR=$STACK_DIR
Environment=STORAGE_ACCOUNT=$STORAGE_ACCOUNT
Environment=ENV_NAME=$ENV_NAME
ExecStart=/bin/bash $SERVER_DIR/backup.sh
UNIT
  cat > /etc/systemd/system/clinithetics-backup.timer <<UNIT
[Unit]
Description=Run the Clinithetics backup every night at 01:30 South African time

[Timer]
OnCalendar=*-*-* 23:30:00 UTC
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable --now clinithetics-backup.timer
else
  echo "Skipping the backup timer (no STORAGE_ACCOUNT or no systemd)."
fi

# --- Summary ------------------------------------------------------------------------
log "Done: Clinithetics $ENV_NAME is running"
cat <<SUMMARY
API:            https://$API_HOSTNAME  (Caddy gets the TLS certificate once DNS points here)
App URL:        $APP_URL
Anon key:       stored in the secret store as $(kv_name ANON_KEY); put it in Vercel as VITE_SUPABASE_ANON_KEY
Service key:    stored as $(kv_name SERVICE_ROLE_KEY); never put it in the app or Vercel
Studio:         private; open an SSH tunnel to port 8000 (see infra/azure/README.md)
SUMMARY
if [ "$smtp_ready" = no ]; then
  cat >&2 <<WARN

WARNING: no email settings found (smtp-host, smtp-user, smtp-pass, smtp-sender in
the secret store). Sign-up confirmations, password resets and invitations will
NOT be delivered. Run infra/azure/acs-smtp.sh, then run this script again.
WARN
fi
