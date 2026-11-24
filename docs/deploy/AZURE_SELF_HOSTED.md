# Runbook: self-hosted Supabase on Azure South Africa North

**Decision (24 Nov 2026):** patient data is hosted in **Azure South Africa
North (Johannesburg)**, not Supabase's cloud. We run the open-source Supabase
stack ourselves, so the app code, database schema, access rules and tests stay
the same. The front end stays on Vercel. It serves static files only; the
browser talks straight to our Azure API, so patient data never passes through
Vercel.

Points marked **[verify]** must be checked against the current Supabase and
Azure docs at set-up time. Both change often.

---

## 1. Shape

```
Browser ──HTTPS──► Vercel (static React app, no patient data)
   │
   └──HTTPS──► api.<domain>  (Azure, South Africa North)
                 Caddy (TLS) ─► Supabase Kong gateway
                                 ├─ Auth (GoTrue: sign-in, TOTP two-step)
                                 ├─ REST (PostgREST: the app's queries and functions)
                                 ├─ Storage (doctor certificates)
                                 └─ Postgres 15 (supabase/postgres image, data disk)
               Nightly + continuous backups ─► Azure Blob Storage (South Africa North)
```

**Why not Azure Database for PostgreSQL (Flexible Server)?** It doesn't grant
true superuser, and Supabase's database image needs extensions and roles
Flexible Server doesn't provide (reports cite `pgjwt`). We run Supabase's own
Postgres image on the VM's managed data disk instead. **[verify]** If Supabase
later supports managed Postgres without superuser (their 2026 changelog moves
Studio off `supabase_admin`), revisit this.

## 2. Azure resources (all in **South Africa North**)

| Resource | Suggested size for the pilot | Notes |
|---|---|---|
| Resource group `rg-clinithetics-prod-zan` | — | Tag `data-classification=health` |
| Linux VM (Ubuntu 24.04 LTS) | 4 vCPU, 16 GB RAM (e.g. D4s v5) **[verify size availability in region]** | Premium SSD OS disk |
| Managed data disk | 128 GB Premium SSD, mounted at `/srv/supabase` | Holds the Postgres data and Storage files |
| Storage account (backups) | Standard, **ZRS** (zone-redundant, stays in SA North) | Private container `db-backups`; soft delete + immutability (time-based retention) on |
| Network security group | Allow inbound **443** (and 80 for certificate renewal) only | **No public SSH**: use Azure Bastion or Just-in-time VM access |
| Azure Backup (VM) | Daily snapshot, 30-day retention | Second line behind database backups |
| Azure Monitor + alerts | CPU, disk > 80%, VM down, backup job failed | Alert to the founder and on-call developer |
| Key Vault | — | Stores the secrets in §4; nothing secret in Git |

Encryption at rest: Azure encrypts managed disks and storage by default
(platform-managed keys). Record this in the compliance doc. Customer-managed
keys are optional later.

## 3. Install

1. Create the resources above. Attach and mount the data disk at
   `/srv/supabase`.
2. Install Docker Engine and the Compose plugin.
3. Get the official self-hosting files: Supabase repo, `docker/` folder, at a
   **pinned release tag**. Never use `latest`. Keep the tag in this doc:
   `SUPABASE_DOCKER_TAG = <fill in>`. See
   <https://supabase.com/docs/guides/self-hosting/docker>.
4. Point the Postgres and Storage volumes at `/srv/supabase/...`.
5. Put **Caddy** (or Nginx + certbot) in front of Kong for TLS on
   `api.<domain>`. Expose only Caddy; Kong, Postgres and Studio listen on
   localhost.
6. **Studio (the admin dashboard) is never public.** Reach it over Bastion /
   an SSH tunnel only.

## 4. Configuration (the `.env` next to `docker-compose.yml`)

Generate fresh values; never reuse the examples from the Supabase repo.
Store them in Key Vault.

| Setting | Value |
|---|---|
| `POSTGRES_PASSWORD` | Long random |
| `JWT_SECRET` | 40+ random characters |
| `ANON_KEY`, `SERVICE_ROLE_KEY` | JWTs signed with `JWT_SECRET` (Supabase docs show how to generate them). The **anon key** goes to Vercel; the **service role key** never leaves the server |
| `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` | For Studio |
| `SITE_URL` | `https://<app domain>` (used in sign-up and password emails) |
| `ADDITIONAL_REDIRECT_URLS` | `https://<app domain>/invite/*` and any preview domains you use |
| `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` | `https://api.<domain>` |
| `SMTP_*` | A transactional email provider (sign-up confirmation, password reset). **[decide provider]** Check its data location too |
| Email sign-up | On; email confirmation **on** |
| TOTP MFA | Must be **enabled** for enrolment and verification in the Auth service. **[verify the exact `GOTRUE_MFA_*` variable names for the pinned version]** Staff can't get past the two-step screen without it |

## 5. Database set-up

1. Start the stack. Confirm `auth`, `storage` and `public` schemas exist.
2. Apply our migrations **in filename order** with `psql` as the `postgres`
   role (over the tunnel):

   ```bash
   for f in supabase/migrations/*.sql; do psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
   ```

   `20250711070631-…sql` is known to fail partway on a fresh database, and
   `scripts/test-db.sh` applies it leniently. Apply it the same way
   (without `ON_ERROR_STOP`), then check the next migrations succeed.
3. Run the test suite against a **copy**, not production:
   `PGHOST=… scripts/test-db.sh` against a scratch database on the same
   Postgres version. All 164 checks must pass.
4. Create the first `super_admin` by hand (see the restrict-signup-roles
   migration).

## 6. Point the app at Azure

1. In Vercel, set `VITE_SUPABASE_URL=https://api.<domain>` and
   `VITE_SUPABASE_ANON_KEY=<anon key>`, then redeploy.
2. In `vercel.json`, change the CSP `connect-src` from
   `https://*.supabase.co wss://*.supabase.co` to
   `https://api.<domain> wss://api.<domain>`. **Until this is done, the
   browser will block every API call.**

## 7. Backups and restore (pilot gate)

- **Continuous:** WAL archiving to the backup storage account (e.g. WAL-G or
  pgBackRest with an Azure Blob target) for point-in-time recovery.
  **[choose tool]**
- **Nightly:** `pg_dump --format=custom` to Blob, kept 35 days. Monthly copies
  kept 12 months.
- **Storage files** (certificates): nightly sync of the Storage volume to Blob.
- **Restore drill before the pilot, then quarterly:** restore last night's
  backup to a scratch VM, run `scripts/test-db.sh`-style checks and a manual
  sign-in, and record the time taken. The PRD's NFRs need this evidence.

## 8. Operating it

| When | Task |
|---|---|
| Weekly | Ubuntu security updates (unattended-upgrades on); check backup alerts |
| Monthly | Review Supabase release notes; upgrade the pinned tag on a staging copy first |
| Quarterly | Restore drill; review who has Azure and Studio access; rotate the dashboard password |
| On incident | Follow the breach-response plan (still to write; see `docs/compliance/REGULATORY_READINESS.md`) |

Someone must own this: name a person and a backup.

## 9. Open questions (founder)

1. **Domains:** app domain and API domain (`api.<domain>`).
2. **Botswana copy:** Azure has no Botswana region. If Botswana's DPA requires
   a copy kept in-country **[verify with counsel]**, add an encrypted backup
   replica at a Botswana host and get any IDPC approval before onboarding
   Botswana clinics.
3. **Email provider** for auth emails, and its data location.
4. **Who runs the server** (in-house developer or managed-service partner),
   with response times.
5. **Staging:** a smaller second VM for testing upgrades and migrations
   (recommended).
