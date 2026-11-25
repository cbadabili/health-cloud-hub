# Hosting: self-hosted Supabase on Azure South Africa North

**Decision (24 Nov 2026):** patient data is hosted in **Azure South Africa
North (Johannesburg)**, not Supabase's cloud.
- We run the open-source Supabase stack ourselves, so the app code, database
  schema, access rules and tests stay the same.
- The front end stays on Vercel. It serves static files only; the browser talks
  straight to our Azure API, so patient data never passes through Vercel.

**Everything here is automated in [`infra/azure/`](../../infra/azure/README.md).**
That README is the step-by-step guide. This page records the design and the
decisions behind it.

---

## 1. Shape

```
Browser ──HTTPS──► Vercel (static React app, no patient data)
   │
   └──HTTPS──► api.clinithetics.beedab.com          (prod)
               api.staging.clinithetics.beedab.com  (staging)
                 Azure VM, South Africa North
                 Caddy (TLS, Let's Encrypt) — forwards only /auth, /rest, /storage
                   └─► Supabase API gateway (Envoy, localhost only)
                         ├─ Auth (sign-in, TOTP two-step, email via Azure Communication Services)
                         ├─ REST (PostgREST: the app's queries and functions)
                         ├─ Storage (doctor certificates)
                         └─ Postgres 17 (Supabase's image, on the data disk)
               Nightly backup ─► Azure Blob Storage (ZRS, South Africa North, 35-day immutable)
               Daily VM snapshot ─► Recovery Services vault
```

**Two environments:** staging (smaller server) for trying updates and Codex's
work, and production. They come from the same template with different sizes.

**Why not Azure Database for PostgreSQL (Flexible Server)?** It doesn't grant
true superuser, and Supabase's database image needs extensions and roles
Flexible Server doesn't provide. We run Supabase's own Postgres image on the
VM's managed data disk instead. If Supabase later supports managed Postgres
without superuser, revisit this.

## 2. What's where

| Piece | File |
|---|---|
| Azure resources (network, VM, disks, storage, Key Vault, backups, monitoring, alerts, email) | `infra/azure/main.bicep` |
| VM first boot (data disk, Docker, Azure CLI, automatic security updates) | `infra/azure/cloud-init.yaml` |
| One-command create/update, run in Cloud Shell | `infra/azure/deploy.sh` |
| Email login for Auth | `infra/azure/acs-smtp.sh` |
| Day-to-day commands (check, logs, backup, restore drill, smoke test) | `infra/azure/ops.sh` |
| Server set-up (Supabase at a pinned commit, secrets, config, migrations) | `infra/azure/server/setup-server.sh` |
| Clinithetics settings on top of Supabase's Compose file | `infra/azure/server/docker-compose.clinithetics.yml` |
| Public entry point | `infra/azure/server/Caddyfile` |
| Migrations with a record of what's applied | `infra/azure/server/apply-migrations.sh` (`ops.applied_migrations`) |
| Health and lock-down checks | `infra/azure/server/check-stack.sh` |
| End-to-end test (staging only) | `infra/azure/server/smoke-flow.mjs` |
| Backup and restore drill | `infra/azure/server/backup.sh`, `restore-drill.sh` |

## 3. Security decisions

- **Network:** only 80 and 443 are open to the internet. SSH is open only from
  one IP if you ask for it.
  - Inside the server, the Supabase gateway and pooler listen on localhost
    only; `check-stack.sh` fails if anything else is exposed.
- **What's public:** Caddy forwards only `/auth/v1`, `/rest/v1` and
  `/storage/v1`. Studio, pg-meta, analytics and functions return 404 from
  outside. Studio is reached over an SSH tunnel (`ops.sh <env> studio`).
- **Secrets:** generated on the server by Supabase's own `generate-keys.sh` on
  first run and kept in Key Vault. They are never in Git or in the deploy
  bundle. The `.env` file is mode 600.
- **Access to Azure resources:** the VM uses its managed identity, with
  write-only scope to the backup container, read access to deploy files and
  access to its own secrets.
  - Storage accepts Entra ID sign-in only (no account keys).
- **Auth:**
  - TOTP two-step sign-in is on;
  - email confirmation is required;
  - passwords need 12+ characters;
  - phone and anonymous sign-in are off.
- **Edge functions are off**: the app doesn't use them, and the runtime
  downloads code from the internet when it boots.
- **Encryption at rest:** Azure encrypts managed disks and storage by default
  (platform-managed keys). Customer-managed keys are optional later.
- **Pinned versions:** Supabase's `docker/` folder is pinned to one commit,
  which pins every image version. Upgrades are deliberate: staging first.

## 4. Backups and recovery

| Layer | What | Kept | Where |
|---|---|---|---|
| Nightly (01:30 SAST) | `pg_dump` of the whole database + archive of uploaded files + checksums | 35 days prod / 7 staging, **immutable** for that period; local copies 3 days | Blob Storage, ZRS, South Africa North |
| Daily (00:00 SAST) | Snapshot of the whole VM | 30 days | Recovery Services vault |
| Alerting | No "backup ok" heartbeat in 26 hours; backup job failures | — | Email to `ALERT_EMAIL` |

- **Restore drill** (`ops.sh <env> restore-drill`): restores the newest dump
  into a temporary database, compares row counts with the live data, and
  prints PASSED/FAILED and the time taken. Run it before the pilot and then
  quarterly, and keep the output for the PRD's NFR evidence.
- **Not yet in place: point-in-time recovery.** Today, the worst case is
  losing up to a day of changes since the last nightly dump. Adding continuous
  WAL archiving (WAL-G or pgBackRest to Blob Storage) is a **pilot-readiness
  follow-up**. Decide the acceptable data-loss window (RPO) first.

## 5. Operating it

| When | Task |
|---|---|
| Automatic | Ubuntu security updates; certificate renewal; nightly backups |
| Weekly | Glance at alert emails; `ops.sh prod check` |
| After merging migrations | `deploy.sh staging`, check, then `deploy.sh prod` |
| Monthly | Review Supabase release notes; move the pinned commit on staging first |
| Quarterly | Restore drill; review who has Azure and Studio access; rotate the dashboard password |
| Every 2 years | Re-run `acs-smtp.sh` before the email password expires |
| On incident | Follow the breach-response plan (still to write; see `docs/compliance/REGULATORY_READINESS.md`) |

Someone must own this: name a person and a backup.

## 6. Decided and open

Decided:
- API `api.clinithetics.beedab.com`, app `clinithetics.beedab.com`
- staging `api.staging.clinithetics.beedab.com` / `staging.clinithetics.beedab.com`
- email via Azure Communication Services (data location: Africa)
- production + staging environments

Open (founder):
1. **Botswana copy:** Azure has no Botswana region. If Botswana's DPA requires
   a copy kept in-country **[verify with counsel]**, add an encrypted backup
   replica at a Botswana host and get any IDPC approval before onboarding
   Botswana clinics.
2. **Who runs the server** (in-house developer or managed-service partner),
   with response times.
3. **Point-in-time recovery:** acceptable data-loss window (see §4).
4. **Email sender domain:** emails come from an Azure address until
   `clinithetics.beedab.com` is added as a verified ACS custom domain (needs
   DNS records).
