# Instructions for Codex

You're picking up Clinithetics, a practice management system for clinics in
Botswana and South Africa. It's React + Vite + Supabase, self-hosted on Azure
South Africa North:

| | Address |
|---|---|
| Production API | `api.clinithetics.beedab.com` |
| Staging API | `api.staging.clinithetics.beedab.com` |
| App | `clinithetics.beedab.com` |

## Read first, in full

1. `docs/HANDOVER-CODEX.md`: the model, database helpers, ground rules and your tasks
2. `infra/azure/README.md` and `docs/deploy/AZURE_SELF_HOSTED.md`: how production is hosted

## Work in this order

1. **Task 0: deploy staging to Azure** (see "Task 0" in the handover).
   - Sign in with the app login from your environment's secrets:
     `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` and
     `AZURE_SUBSCRIPTION_ID`.
   - Run `bash infra/azure/deploy.sh staging`.
   - Report back the DNS record, the Vercel settings and any email note it
     prints, plus any errors.
   - If your environment has no Azure login, skip to Task A and say so.
2. **Task A:** Increment 1 leftovers (one pull request).
3. **Task B:** Increment 2, front desk (one pull request).

Don't start Increments 3–7.

## Hard rules

- **Secrets:** never print, log or commit them (the Azure client secret, the
  service role key, the database password, anything from Key Vault). The anon
  key is public by design.
- **Production:** never run `deploy.sh prod` without the founder's written
  go-ahead for that run.
- **Azure resources:** never delete them or the resource groups. If Azure
  refuses something for permissions, report it. Don't change `main.bicep`,
  role assignments, network rules or the server lock-down to get past it.
- **Access control:** enforce access in the database with row-level security
  and the existing helpers (`has_practice_role`, `can_access_row`,
  `is_portal_patient`, etc.), never only in the UI. Every practice table has
  `practice_id`.
- **Migrations:**
  - every migration ships with tests in `supabase/tests/`;
  - production runs Postgres 17;
  - never edit a migration that has already been merged; add a new one.
- **Hosted-only features:** none that exist only on Supabase's hosted
  platform. Edge functions are off on our servers.
- **Honesty in the UI:** never show success before the database confirms.
  Never describe the product as "compliant".
- **If a rule blocks you,** stop and explain.

## Each pull request must show

- `scripts/test-db.sh` all green, including the existing 164 checks
- `npm test`
- `npx tsc -p tsconfig.app.json --noEmit`
- `npm run lint` with 0 errors
- `npm run build`
- screenshots of new screens at 390px and desktop, in light and dark mode

List any new migrations in the PR description. They go live by re-running
`deploy.sh` on staging, then prod.
