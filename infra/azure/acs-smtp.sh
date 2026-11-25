#!/usr/bin/env bash
# Give the server an SMTP login for Azure Communication Services email, and
# store it in Key Vault. Called by deploy.sh the first time; safe to re-run
# (it issues a fresh password and the next deploy.sh run picks it up).
#
# Usage: acs-smtp.sh <resource-group> <communication-service> <key-vault> <sender-address> <env>
#
# Microsoft's guide: https://learn.microsoft.com/azure/communication-services/quickstarts/email/send-email-smtp/smtp-authentication
set -euo pipefail

RG=${1:?resource group}
ACS=${2:?communication service name}
VAULT=${3:?key vault name}
SENDER=${4:?sender address}
ENV_NAME=${5:?env}
APP_NAME=clinithetics-smtp-$ENV_NAME

tenant=$(az account show --query tenantId --output tsv)
acs_id=$(az resource show --resource-group "$RG" --name "$ACS" \
  --resource-type Microsoft.Communication/communicationServices --query id --output tsv)

app_id=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" --output tsv)
if [ -z "$app_id" ]; then
  app_id=$(az ad app create --display-name "$APP_NAME" --sign-in-audience AzureADMyOrg --query appId --output tsv)
  echo "Created Entra application $APP_NAME ($app_id)"
fi
sp_id=$(az ad sp show --id "$app_id" --query id --output tsv 2>/dev/null || true)
[ -n "$sp_id" ] || sp_id=$(az ad sp create --id "$app_id" --query id --output tsv)

# Built-in role first; if this tenant doesn't have it, a minimal custom role.
# (Microsoft's checks on these permission names are case-sensitive.)
if ! az role assignment create --assignee-object-id "$sp_id" --assignee-principal-type ServicePrincipal \
    --role "Communication and Email Service Owner" --scope "$acs_id" --output none 2>/dev/null; then
  role_name="Clinithetics ACS SMTP sender ($ENV_NAME)"
  if [ -z "$(az role definition list --name "$role_name" --query "[0].id" --output tsv)" ]; then
    sub=$(az account show --query id --output tsv)
    az role definition create --output none --role-definition "{
      \"Name\": \"$role_name\",
      \"Description\": \"Send email through Azure Communication Services SMTP.\",
      \"Actions\": [
        \"Microsoft.Communication/CommunicationServices/Read\",
        \"Microsoft.Communication/CommunicationServices/Write\",
        \"Microsoft.Communication/EmailServices/write\"
      ],
      \"AssignableScopes\": [\"/subscriptions/$sub\"]
    }"
    sleep 20
  fi
  az role assignment create --assignee-object-id "$sp_id" --assignee-principal-type ServicePrincipal \
    --role "$role_name" --scope "$acs_id" --output none
fi

password=$(az ad app credential reset --id "$app_id" --append --display-name "smtp-$(date -u +%Y%m%d)" \
  --years 2 --query password --output tsv)

set_secret() { az keyvault secret set --vault-name "$VAULT" --name "$1" --value "$2" --output none; }
set_secret smtp-host smtp.azurecomm.net
set_secret smtp-user "$ACS|$app_id|$tenant"
set_secret smtp-pass "$password"
set_secret smtp-sender "$SENDER"

echo "Email login stored in $VAULT. Sender: $SENDER (Azure-managed domain)."
echo "The password expires in 2 years; re-run this script before then."
