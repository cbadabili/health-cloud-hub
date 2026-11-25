#!/usr/bin/env bash
# Create or update one Clinithetics environment in Azure. Run in Azure Cloud Shell (Bash):
#
#   git clone https://github.com/cbadabili/health-cloud-hub && cd health-cloud-hub
#   cp infra/azure/config.example.env infra/azure/config.env   # then edit it
#   bash infra/azure/deploy.sh staging    # try staging first
#   bash infra/azure/deploy.sh prod
#
# Safe to run again: it updates the resources, reuses the server's secrets and
# applies only new database migrations. Run it again after merging new migrations.
set -euo pipefail

ENV_NAME=${1:-}
case "$ENV_NAME" in
  prod)
    API_HOSTNAME=api.clinithetics.beedab.com
    APP_URL=https://clinithetics.beedab.com
    EXTRA_REDIRECTS=""
    ;;
  staging)
    API_HOSTNAME=api.staging.clinithetics.beedab.com
    APP_URL=https://staging.clinithetics.beedab.com
    # Vercel preview deployments may sign in against staging.
    EXTRA_REDIRECTS="https://*.vercel.app/**"
    ;;
  *) echo "Usage: deploy.sh prod|staging" >&2; exit 1 ;;
esac

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
CONFIG=$HERE/config.env
[ -f "$CONFIG" ] || { echo "Create $CONFIG first (copy config.example.env)." >&2; exit 1; }
# shellcheck source=/dev/null
. "$CONFIG"
: "${ALERT_EMAIL:?Set ALERT_EMAIL in config.env}"
SSH_SOURCE_CIDR=${SSH_SOURCE_CIDR:-}
DEPLOY_BASTION=${DEPLOY_BASTION:-false}

RG=rg-clinithetics-$ENV_NAME
LOCATION=southafricanorth
step() { printf '\n==> %s\n' "$*"; }

command -v az >/dev/null || { echo "Run this in Azure Cloud Shell, or install the Azure CLI." >&2; exit 1; }
[ -n "${AZURE_SUBSCRIPTION:-}" ] && az account set --subscription "$AZURE_SUBSCRIPTION"
az account show --query "{subscription:name, tenant:tenantId}" --output table

step "Checking the server size is available in South Africa North"
VM_SIZE=$([ "$ENV_NAME" = prod ] && echo Standard_D4s_v5 || echo Standard_B2ms)
restricted=$(az vm list-skus --location "$LOCATION" --size "$VM_SIZE" --resource-type virtualMachines \
  --query "[0].restrictions[?type=='Location'] | length(@)" --output tsv 2>/dev/null || echo unknown)
if [ "$restricted" != "0" ]; then
  echo "WARNING: $VM_SIZE may not be available to this subscription in $LOCATION (check: $restricted)."
  echo "If the deployment fails on the VM size, re-run with VM_SIZE_OVERRIDE set to another size, e.g. Standard_D4as_v5."
fi
VM_SIZE=${VM_SIZE_OVERRIDE:-$VM_SIZE}

step "SSH key for the server admin account"
KEY=$HOME/.ssh/clinithetics_ed25519
[ -f "$KEY" ] || ssh-keygen -t ed25519 -N "" -C "clinithetics-admin" -f "$KEY" > /dev/null
echo "Using $KEY.pub (keep the private key safe; it's only needed for SSH)."

step "Resource group $RG"
az group create --name "$RG" --location "$LOCATION" \
  --tags app=clinithetics env="$ENV_NAME" data-classification=health --output none

step "Deploying Azure resources (takes 5-15 minutes)"
DEPLOYER=$(az ad signed-in-user show --query id --output tsv)
az deployment group create --resource-group "$RG" --name "clinithetics-$(date -u +%Y%m%d%H%M%S)" \
  --template-file "$HERE/main.bicep" \
  --parameters env="$ENV_NAME" apiHostname="$API_HOSTNAME" alertEmail="$ALERT_EMAIL" \
    adminSshPublicKey="$(cat "$KEY.pub")" deployerObjectId="$DEPLOYER" \
    sshSourceCidr="$SSH_SOURCE_CIDR" deployBastion="$DEPLOY_BASTION" vmSize="$VM_SIZE" \
  --query properties.outputs --output json > "/tmp/clinithetics-$ENV_NAME-outputs.json"
out() { python3 -c "import json,sys; print(json.load(open('/tmp/clinithetics-$ENV_NAME-outputs.json'))['$1']['value'])"; }
VM=$(out vmName)
IP=$(out publicIp)
STORAGE=$(out storageAccount)
VAULT=$(out keyVault)
ACS=$(out communicationService)
SENDER=$(out senderAddress)
echo "Server $VM at $IP; storage $STORAGE; vault $VAULT"

run_on_vm() {
  # Runs a script on the server as root and prints its output.
  az vm run-command invoke --resource-group "$RG" --name "$VM" --command-id RunShellScript \
    --scripts "$1" --query "value[0].message" --output tsv
}

step "Waiting for the server's first-boot set-up (Docker, Azure CLI)"
run_on_vm 'cloud-init status --wait > /dev/null 2>&1; test -f /var/lib/clinithetics/cloud-init-done && echo READY || { cloud-init status --long; echo NOT_READY; }' | tee /tmp/clinithetics-ci.txt
if grep -q NOT_READY /tmp/clinithetics-ci.txt || ! grep -q READY /tmp/clinithetics-ci.txt; then
  echo "First-boot set-up failed. See: az vm boot-diagnostics get-boot-log -g $RG -n $VM" >&2
  exit 1
fi

step "Email service (Azure Communication Services)"
if [ -z "$(az keyvault secret show --vault-name "$VAULT" --name smtp-user --query value --output tsv 2>/dev/null || true)" ]; then
  bash "$HERE/acs-smtp.sh" "$RG" "$ACS" "$VAULT" "$SENDER" "$ENV_NAME"
else
  echo "Email credentials already in Key Vault."
fi

step "Uploading this version of the app's database migrations and server scripts"
VERSION=$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || date -u +%Y%m%d%H%M%S)
BUNDLE=/tmp/clinithetics-$VERSION.tar.gz
tar -C "$REPO" -czf "$BUNDLE" supabase/migrations infra/azure/server
for attempt in 1 2 3 4 5 6; do
  # New role assignments can take a few minutes to apply.
  if az storage blob upload --auth-mode login --only-show-errors --output none --overwrite \
      --account-name "$STORAGE" --container-name deploy --name "bundles/$VERSION.tar.gz" --file "$BUNDLE"; then
    break
  fi
  [ "$attempt" = 6 ] && { echo "Upload failed." >&2; exit 1; }
  echo "Waiting for storage access to apply (attempt $attempt)..."; sleep 30
done

step "Installing / updating the Supabase stack on the server (first run: 10-20 minutes)"
SETUP_SCRIPT=$(cat <<SCRIPT
set -e
export HOME=/root
az login --identity --output none
dir=/srv/supabase/app/$VERSION
mkdir -p "\$dir"
az storage blob download --auth-mode login --only-show-errors --output none \
  --account-name $STORAGE --container-name deploy --name bundles/$VERSION.tar.gz --file /tmp/bundle.tar.gz
tar -xzf /tmp/bundle.tar.gz -C "\$dir"
ln -sfn "\$dir" /srv/supabase/app/current
ENV_NAME=$ENV_NAME API_HOSTNAME=$API_HOSTNAME APP_URL=$APP_URL EXTRA_REDIRECTS='$EXTRA_REDIRECTS' \
  ACME_EMAIL=$ALERT_EMAIL KEY_VAULT_NAME=$VAULT STORAGE_ACCOUNT=$STORAGE \
  APP_BUNDLE_DIR=/srv/supabase/app/current \
  bash /srv/supabase/app/current/infra/azure/server/setup-server.sh > /var/log/clinithetics-setup.log 2>&1 \
  && echo SETUP_OK || echo SETUP_FAILED
tail -n 40 /var/log/clinithetics-setup.log
SCRIPT
)
run_on_vm "$SETUP_SCRIPT" | tee /tmp/clinithetics-setup.txt
grep -q SETUP_OK /tmp/clinithetics-setup.txt || {
  echo "Set-up failed. The full log is on the server at /var/log/clinithetics-setup.log:" >&2
  echo "  bash infra/azure/ops.sh $ENV_NAME logs" >&2
  exit 1
}

ANON_KEY=$(az keyvault secret show --vault-name "$VAULT" --name anon-key --query value --output tsv)
step "Done. Three things for you to do now:"
cat <<NEXT

1. DNS (where beedab.com is managed): add an A record
     $API_HOSTNAME  ->  $IP
   Caddy on the server gets the HTTPS certificate by itself within a few
   minutes of the record working. Check: bash infra/azure/ops.sh $ENV_NAME check

2. Vercel project settings -> Environment Variables ($( [ "$ENV_NAME" = prod ] && echo Production || echo Preview )):
     VITE_SUPABASE_URL      = https://$API_HOSTNAME
     VITE_SUPABASE_ANON_KEY = $ANON_KEY
   (The anon key is meant to be public; the service key stays in Key Vault.)
   Then redeploy. $( [ "$ENV_NAME" = prod ] && echo "Add $APP_URL as the production domain." || echo "Optionally add $APP_URL as a domain for a staging branch." )

3. Run the restore drill once the first nightly backup exists (or now):
     bash infra/azure/ops.sh $ENV_NAME backup-now
     bash infra/azure/ops.sh $ENV_NAME restore-drill

NEXT
