#!/usr/bin/env bash
# Day-to-day operations on a Clinithetics server, from Azure Cloud Shell.
#
# Usage: ops.sh <prod|staging> <command>
#   check          health and lock-down checks, including the public HTTPS address
#   logs           the last set-up log and recent container status
#   backup-now     run the nightly backup immediately
#   restore-drill  restore the newest backup into a temporary database and compare
#   smoke          (staging only) end-to-end test: sign-up, two-step sign-in, practice, patient
#   studio         how to open Supabase Studio (the database admin) privately
#   email-setup    (founder, in Cloud Shell) create the email login; then re-run deploy.sh
set -euo pipefail

ENV_NAME=${1:-}
CMD=${2:-}
case "$ENV_NAME" in prod|staging) ;; *) echo "Usage: ops.sh prod|staging <command>" >&2; exit 1 ;; esac
RG=rg-clinithetics-$ENV_NAME
API_HOSTNAME=$([ "$ENV_NAME" = prod ] && echo api.clinithetics.beedab.com || echo api.staging.clinithetics.beedab.com)
VM=clin-$ENV_NAME-vm
STACK=/srv/supabase/upstream/docker
SERVER=/srv/supabase/app/current/infra/azure/server
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

run_on_vm() {
  az vm run-command invoke --resource-group "$RG" --name "$VM" --command-id RunShellScript \
    --scripts "$1" --query "value[0].message" --output tsv
}
storage() { az storage account list --resource-group "$RG" --query "[0].name" --output tsv; }
vault() { az keyvault list --resource-group "$RG" --query "[0].name" --output tsv; }

case "$CMD" in
  check)
    run_on_vm "PUBLIC_URL=https://$API_HOSTNAME bash $SERVER/check-stack.sh $STACK"
    ;;
  logs)
    run_on_vm "tail -n 60 /var/log/clinithetics-setup.log; echo; cd $STACK && docker compose ps --format 'table {{.Name}}\t{{.Status}}'; echo; journalctl -u clinithetics-backup --no-pager -n 20"
    ;;
  backup-now)
    run_on_vm "systemctl start clinithetics-backup.service && journalctl -u clinithetics-backup --no-pager -n 15"
    ;;
  restore-drill)
    run_on_vm "export HOME=/root; STACK_DIR=$STACK ENV_NAME=$ENV_NAME STORAGE_ACCOUNT=$(storage) bash $SERVER/restore-drill.sh"
    ;;
  smoke)
    [ "$ENV_NAME" = staging ] || { echo "The smoke test writes test data, so it only runs on staging." >&2; exit 1; }
    v=$(vault)
    (cd "$HERE/../.." && npm ci --silent && \
      API_URL=https://$API_HOSTNAME ENV_NAME=staging \
      ANON_KEY=$(az keyvault secret show --vault-name "$v" --name anon-key --query value -o tsv) \
      SERVICE_ROLE_KEY=$(az keyvault secret show --vault-name "$v" --name service-role-key --query value -o tsv) \
      node infra/azure/server/smoke-flow.mjs)
    ;;
  email-setup)
    acs=$(az resource list --resource-group "$RG" --resource-type Microsoft.Communication/communicationServices --query "[0].name" --output tsv)
    email_service=$(az resource list --resource-group "$RG" --resource-type Microsoft.Communication/emailServices --query "[0].name" --output tsv)
    domain=$(az resource show --resource-group "$RG" --name "$email_service/AzureManagedDomain" \
      --resource-type Microsoft.Communication/emailServices/domains --query properties.mailFromSenderDomain --output tsv)
    [ -n "$acs" ] && [ -n "$domain" ] || { echo "Deploy $ENV_NAME first (no email service found in $RG)." >&2; exit 1; }
    bash "$HERE/acs-smtp.sh" "$RG" "$acs" "$(vault)" "DoNotReply@$domain" "$ENV_NAME"
    echo "Now run: bash infra/azure/deploy.sh $ENV_NAME"
    ;;
  studio)
    cat <<HELP
Studio (the database admin) is never exposed to the internet. To open it:
  1. Allow SSH from your IP: set SSH_SOURCE_CIDR in infra/azure/config.env and re-run deploy.sh
     (or set DEPLOY_BASTION=true and use Bastion's native client tunnel).
  2. ssh -i ~/.ssh/clinithetics_ed25519 -L 8000:127.0.0.1:8000 clinadmin@<server IP>
  3. Open http://localhost:8000 and sign in with the dashboard user:
       user:     supabase
       password: az keyvault secret show --vault-name $(vault) --name dashboard-password --query value -o tsv
  4. Remove SSH_SOURCE_CIDR again afterwards.
HELP
    ;;
  *) sed -n '2,11p' "$0"; exit 1 ;;
esac
