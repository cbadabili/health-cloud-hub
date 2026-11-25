# Setting up the Azure servers

This folder creates and runs the Clinithetics servers in **Azure South Africa
North (Johannesburg)**. There are two environments:

| | Staging | Production |
|---|---|---|
| Purpose | Try updates and Codex's work first | Real clinics and patients |
| API address | `api.staging.clinithetics.beedab.com` | `api.clinithetics.beedab.com` |
| App address | `staging.clinithetics.beedab.com` (and Vercel previews) | `clinithetics.beedab.com` |
| Server | Standard_B2ms (2 vCPU, 8 GB) | Standard_D4s_v5 (4 vCPU, 16 GB) |

Everything is created by one command per environment. You run it yourself in
Azure Cloud Shell, so no Azure keys ever leave your account.

## What gets created (per environment)

- A Linux server with a separate data disk for the database and files.
  - Only HTTPS is open to the internet; there's no password login.
- **Caddy**: gets and renews the HTTPS certificate automatically.
- **Supabase** (sign-in, database, file storage), at a fixed, tested version.
  - The database admin screen (Studio) is never public.
- **Key Vault**: the server generates its own passwords and keys and keeps them here.
- **Backups**:
  - a nightly database + files backup to zone-redundant storage in South
    Africa North, which can't be deleted for 35 days (7 on staging);
  - plus a daily snapshot of the whole server, kept 30 days.
- **Alerts by email**: server down, CPU high, disk over 80%, no backup in 26
  hours, and backup job failures.
- **Email sending** for sign-up confirmations, password resets and invitations
  (Azure Communication Services). It sends from an Azure address
  (`DoNotReply@…azurecomm.net`) until you add your own domain.

## Before you start

1. An Azure subscription where you are **Owner**. The script assigns access
   roles, so Contributor isn't enough.
2. Access to the DNS settings for `beedab.com`.
3. Access to the Vercel project settings.

## Step by step

### 1. Open Azure Cloud Shell
In the Azure portal, click the **>_** icon at the top, choose **Bash**, and let
it create its storage if asked.

### 2. Get the code
```bash
git clone https://github.com/cbadabili/health-cloud-hub
```
```bash
cd health-cloud-hub
```
If the repository is private, Git asks for a username and a GitHub personal
access token (with read access to the repository) instead of a password.

### 3. Fill in the settings
```bash
cp infra/azure/config.example.env infra/azure/config.env
```
```bash
nano infra/azure/config.env
```
Set `ALERT_EMAIL` (who gets alerts and certificate notices). Save with
Ctrl+O, Enter, and exit with Ctrl+X.

### 4. Create staging first
```bash
bash infra/azure/deploy.sh staging
```
This takes about 20–30 minutes the first time. It ends by printing three
things to do. Do them:
- **DNS:** add the `A` record it shows, for `api.staging.clinithetics.beedab.com`.
- **Vercel:** set the two environment variables it shows for **Preview**,
  then redeploy.
- **Check:** after the DNS record works (usually minutes), run:
  ```bash
  bash infra/azure/ops.sh staging check
  ```
  Every line should say `ok`, including the HTTPS checks.

Then run the end-to-end test. It creates a test doctor and practice on staging,
including a real two-step sign-in:
```bash
bash infra/azure/ops.sh staging smoke
```

### 5. Create production
```bash
bash infra/azure/deploy.sh prod
```
Do the same three things, using **Production** in Vercel and adding
`clinithetics.beedab.com` as the production domain. Don't run `smoke` on
production; it refuses to.

### 6. Prove the backups work (do this before the pilot, then every quarter)
```bash
bash infra/azure/ops.sh prod backup-now
```
```bash
bash infra/azure/ops.sh prod restore-drill
```
The drill restores the newest backup into a temporary database, compares it
with the live data and prints `PASSED` and how long it took. Save that output
for your records.

### 7. Lock the backup retention (once you're happy)
The 35-day "can't be deleted" rule starts **unlocked**, so it can be changed.
Once locked, nobody (including you) can shorten it:
Portal → storage account `stclinprod…` → Containers → `db-backups` → Access
policy → the time-based retention policy → **Lock policy**.

### 8. Create the first platform admin
Sign up in the app with your own email, then make that account the platform
admin (it approves doctors' registrations):
```bash
bash infra/azure/ops.sh prod studio
```
Follow the steps to open Studio. Then, in its SQL editor, run:
```sql
UPDATE public.user_roles SET role = 'super_admin'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
```

## Letting Codex (or another automated tool) deploy

An automated tool can't sign in as you, so it gets its own **app login** (a
"service principal"). It's limited to **Owner of the two Clinithetics
resource groups only**: it can't touch anything else in your subscription,
and it can't create directory (Entra) objects. Do these once, yourself, in
Cloud Shell:

1. Switch on the Azure services Clinithetics uses (an app login limited to
   resource groups can't):
   ```bash
   for p in Microsoft.Compute Microsoft.Network Microsoft.Storage Microsoft.KeyVault Microsoft.RecoveryServices Microsoft.OperationalInsights Microsoft.Insights Microsoft.AlertsManagement Microsoft.Communication; do az provider register --namespace $p; done
   ```
   Then create the two resource groups, so the login can be limited to them:
   ```bash
   az group create -n rg-clinithetics-staging -l southafricanorth
   ```
   ```bash
   az group create -n rg-clinithetics-prod -l southafricanorth
   ```
2. Create the app login, scoped to those groups only:
   ```bash
   SUB=$(az account show --query id -o tsv)
   ```
   ```bash
   az ad sp create-for-rbac --name clinithetics-deployer --role Owner --scopes /subscriptions/$SUB/resourceGroups/rg-clinithetics-staging /subscriptions/$SUB/resourceGroups/rg-clinithetics-prod
   ```
   It prints `appId`, `password` and `tenant`. **The password is shown only once.**
   Put it straight into Codex's secret settings; never paste it into a chat,
   an email or the repository.
3. Find the login's object ID:
   ```bash
   az ad sp show --id <appId> --query id -o tsv
   ```
4. In Codex's environment settings:
   - **Secrets:** `AZURE_CLIENT_ID` (appId), `AZURE_CLIENT_SECRET` (password),
     `AZURE_TENANT_ID` (tenant).
   - **Variables:** `AZURE_SUBSCRIPTION_ID` (`$SUB`),
     `DEPLOYER_OBJECT_ID` (step 3) and `ALERT_EMAIL`.
   - **Tools:** the Azure CLI.
   - **Internet access** to `management.azure.com`,
     `login.microsoftonline.com`, `graph.microsoft.com`, `*.vault.azure.net`
     and `*.blob.core.windows.net`.
5. **After Codex's first deploy of each environment**, set up email (this
   step needs directory rights, so it's yours):
   ```bash
   bash infra/azure/ops.sh staging email-setup
   ```
   Then ask Codex to run `deploy.sh staging` again so the server picks it up.
   Do the same for `prod`.

The DNS records and Vercel settings that `deploy.sh` prints are still yours
to add. When you no longer want Codex to deploy, delete the login:
`az ad sp delete --id <appId>`. The password also expires after a year;
`az ad sp credential reset --id <appId>` issues a new one.

## Updating later

- **After new database migrations are merged:** run
  `bash infra/azure/deploy.sh staging`, check it, then
  `bash infra/azure/deploy.sh prod`. Only new migrations are applied.
- **Supabase upgrades:**
  1. Change `DEFAULT_SUPABASE_REF` in `server/setup-server.sh` to a newer
     commit.
  2. Run staging, `ops.sh staging check` and `ops.sh staging smoke`.
  3. Then production.
- **Ubuntu security updates** install automatically.

## Day-to-day commands

| Command | What it does |
|---|---|
| `bash infra/azure/ops.sh prod check` | Health and lock-down checks |
| `bash infra/azure/ops.sh prod logs` | Last set-up log, container status, recent backups |
| `bash infra/azure/ops.sh prod backup-now` | Back up immediately |
| `bash infra/azure/ops.sh prod restore-drill` | Test-restore the newest backup |
| `bash infra/azure/ops.sh prod studio` | How to open the database admin privately |

## Rough monthly cost (approximate, before VAT)

Check current prices with the [Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/)
(region: South Africa North). Very roughly:

| | Staging | Production |
|---|---|---|
| Server | US$60–90 | US$170–220 |
| Disks | US$15–25 | US$25–40 |
| Backups (storage + server snapshots) | US$10–25 | US$20–50 |
| Monitoring logs | US$5–15 | US$5–20 |
| Email | cents per thousand emails | same |
| Bastion (only if `DEPLOY_BASTION=true`) | +US$140 | +US$140 |

## What has and hasn't been tested

- **Tested on a real Supabase stack in Docker:**
  - the server set-up script, including re-running it;
  - all database migrations on Supabase's Postgres 17;
  - the lock-down checks;
  - the end-to-end smoke test, including a real authenticator code;
  - the real web app signing in, setting up two-step sign-in and registering a
    patient;
  - backup and restore.
- **Checked but not run against Azure:**
  - the Azure template (compiled against Azure's published schemas);
  - `deploy.sh` (run against a fake Azure CLI);
  - first-boot set-up, the email login and the alerts.

  The first `deploy.sh staging` run is the real test of these; that's why
  staging comes first.

## If something goes wrong

- **`deploy.sh` stops with an error:** read the message. Running it again is
  safe.
- **VM size not available:** run it again with
  `VM_SIZE_OVERRIDE=Standard_D4as_v5 bash infra/azure/deploy.sh prod`
  (or `Standard_B2as_v2` for staging).
- **Set-up failed on the server:** `bash infra/azure/ops.sh <env> logs` shows
  why.
- **HTTPS check fails:** the DNS `A` record is missing or hasn't spread yet.
  Port 80 must stay open, because certificates are renewed through it.
