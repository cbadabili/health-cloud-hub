# Handover: building on the practice platform

Clinithetics is a React + Vite + Supabase **practice management system** for
independent clinics in **Botswana and South Africa**. Reception, nurses,
clinicians, billers and managers work on one shared patient record per
practice. A patient portal runs alongside it.

The product plan is in the PRD (Draft v1.0, 24 Nov 2026). Increment 1
(foundation) is done. Read **Ground rules** before touching the database.

---

## Start here

**Live on `main`:** Increment 1 (PR #16): practices, sites, rooms, per-practice
staff roles, invitations, staff two-step sign-in, patient registry with
duplicate review and merge, audit log, portal re-linking, Pula/Rand locale.

**Hosting:** we do **not** use Supabase's cloud. We run the open-source
Supabase stack ourselves on an Azure VM in **South Africa North**, so patient
data stays in South Africa. See `docs/deploy/AZURE_SELF_HOSTED.md`. For you
nothing changes in code: `supabase-js`, RLS, `auth.uid()`, Storage and the
test harness all work the same. Don't add features that only exist on
Supabase's hosted platform (managed Edge Functions, hosted cron, branching,
Supabase AI, log drains) without checking they run self-hosted.

**Founder still has to** (not code; don't block on these, but don't guess them either):
1. Create the Azure servers with `infra/azure/deploy.sh` (see `infra/azure/README.md`),
   including enabling TOTP MFA in the Auth service. Domains are set: app
   `clinithetics.beedab.com`, API `api.clinithetics.beedab.com` (already
   allowed in the `vercel.json` CSP).
2. Decide Pula plan prices (`src/config/pricing.ts`, currently `null`), the
   Botswana in-country copy question, the pilot clinics and the Omang format
   (`checkNationalId` in `src/lib/locale.ts` assumes 9 digits and only warns).

**Work order for Codex:** Task A (leftovers), then Task B (Increment 2, front
desk). One PR per task. Don't start Increments 3–7.

---

## The model (Increment 1)

```
tenants ─ practices ─ sites ─ rooms
              │
              ├─ staff_memberships (user × role, all_sites or membership_sites) ─ providers (clinicians)
              ├─ staff_invitations (hashed one-time tokens, 7 days)
              ├─ patients (practice records; no login needed) ─ patient_contacts
              │      └─ patient_portal_links (pending → verified by reception)
              ├─ appointments · medical_records · prescriptions · invoices
              └─ audit_events (append-only)
```

- **Country is a practice setting.** `practices.country` (`BW` | `ZA`) fixes
  currency (`BWP` | `ZAR`) and time zone at creation. Never hardcode R, P, a
  time zone or an ID type: use `src/lib/locale.ts` (`COUNTRIES`,
  `formatMoney`, `formatDate`/`formatTime`/`formatDateTime(iso, tz)`,
  `formatCalendarDate` for birth dates, `normalizePhone` → E.164,
  `checkNationalId`, `zonedTimeToDate`).
- **Roles are per practice:** `owner`, `manager`, `receptionist`, `nurse`,
  `clinician`, `biller` (`practice_role`). One person can hold several.
  `user_roles` (`app_role`) is only for platform level: `super_admin`, and
  `doctor`/`patient` at sign-up.
- **Clinicians** get a `providers` row. Clinical writes also need an approved
  `doctor_verifications` row (`is_verified_doctor`).
- **Patients are records, not logins.** Every clinical and billing foreign key
  is `ON DELETE RESTRICT`. A portal user sees a patient only through a
  `verified` `patient_portal_links` row (or the record they created by booking
  online, until reception verifies it).
- **Staff MFA:** when `practices.require_mfa` (default true), staff policies
  require an `aal2` session. `StaffMfaGate` handles TOTP enrolment and challenge.

### Database helpers (use these in every new policy)
| Helper | Meaning |
|---|---|
| `has_practice_role(practice, roles[] = any)` | Active membership with one of the roles **and** MFA satisfied |
| `can_access_site(site, roles)` / `can_access_row(practice, site, roles)` | Same, plus the member's site scope |
| `is_practice_clinician(practice)` | Clinician role + verified registration |
| `my_provider_id(practice)` | The caller's provider id there |
| `is_portal_patient(patient)` | The caller is linked to this patient record |
| `is_staff_mfa_ok(practice)` | `aal2`, or the practice doesn't require MFA |

### Functions the app calls
`my_practices`, `create_practice`, `invite_staff`, `revoke_invitation`,
`invitation_preview` (anon), `accept_invitation`, `deactivate_staff`,
`set_staff_sites`, `practice_staff_directory`, `register_patient` (returns
possible duplicates unless `_confirm_new`), `find_patient_duplicates`,
`merge_patients`, `verify_portal_link`, `log_patient_view`, and for the portal
`list_bookable_providers`, `provider_booked_slots`, `book_appointment`,
`cancel_my_appointment`. Error codes they raise are mapped to friendly text in
`practiceErrorMessage` (`src/lib/practice.ts`) and `bookingErrorMessage`
(`src/lib/booking.ts`).

### App structure
- `src/hooks/usePractice.tsx`: current practice, roles, `provider_id`,
  `hasRole(...)`, practice switcher state.
- `src/pages/Dashboard.tsx` routes: any membership → `StaffWorkspace`;
  `super_admin` → admin; verified doctor without a practice → `/onboarding`;
  otherwise the patient portal.
- `src/pages/practice/`: `StaffWorkspace` (tabs by role), `Onboarding`,
  `AcceptInvite` (`/invite/:token`).
- `src/components/practice/`: `PatientRegistry`, `RegisterPatientDialog`,
  `PatientDetailSheet` (details, contacts, portal links, timeline, merge),
  and `admin/` (`StaffAdmin`, `SitesAdmin`, `PracticeSettings`, `AuditLog`).
- Doctor screens (`src/components/doctor/`) filter by the clinician's
  `provider_id`. Portal screens (`src/components/patient/`) find the user's
  patient ids with `myPortalPatientIds`.
- Plan prices live in `src/config/pricing.ts` per currency. `null` shows
  "Contact us".

---

## Before you start

**Database migrations.** The founder (or whoever runs the server) applies
migrations by re-running `bash infra/azure/deploy.sh staging` then `prod`;
it applies only new files, in filename order, and records them in
`ops.applied_migrations`. Production runs **Postgres 17** (CI tests on 17 too). Increment 1 adds
`20261125090000-tenancy-foundation.sql`. **It wipes test rows in
appointments, medical records, prescriptions and invoices** on its first run
(there is no production data yet). After applying it:
- TOTP MFA is already enabled by `infra/azure/server/docker-compose.clinithetics.yml`;
- regenerate `src/integrations/supabase/types.ts` (or edit by hand).

**Never edit a migration that has been applied.** The server records each
file's checksum and stops if an applied file changes. Fix things with a new
migration. Infrastructure lives in `infra/azure/`; CI checks it with
shellcheck and the Bicep compiler.

The app shows "Practice features aren't switched on yet" when `my_practices`
is missing. Keep doing this for new migrations: an honest "not available yet"
state, never a broken screen.

**Run locally.** Create `.env.local` with `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`, then `npm install && npm run dev`.

**Before every PR** (CI runs all of these in `.github/workflows/ci.yml`):
`npx tsc -p tsconfig.app.json --noEmit`, `npm run lint` (0 errors),
`npm test` (vitest), `npm run build`, and `scripts/test-db.sh` (needs a local
Postgres 15+ superuser via `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`).

---

## Ground rules

1. **Never show success for something that didn't happen.** Success only
   after the database confirms. Until a feature works, hide its button or mark
   it "Coming soon".
2. **Every practice-scoped table has `practice_id` and RLS via the helpers
   above.** Rows with a site also check site scope. Add the table to
   `enforce_same_practice` (cross-practice references are rejected) and to
   the `audit_row_change` trigger.
3. **Enforce access in the database, not the UI.** Anyone can call Supabase
   with the anon key. Never derive permissions from `user_metadata`. Prefer
   narrow `SECURITY DEFINER` functions (`SET search_path = ''`, `REVOKE …
   FROM PUBLIC, anon`, checks on `auth.uid()`), and column-level `GRANT
   UPDATE (…)` for fields staff may edit directly.
4. **Audit, never log content.** Audit rows hold ids, action and changed
   column names only. Reads that matter (opening a chart) call
   `log_patient_view`. `audit_events` is append-only; don't add update or
   delete paths.
5. **No cascades onto clinical or financial history.** Foreign keys from
   those tables are `ON DELETE RESTRICT`.
6. **Every migration ships with tests** in `supabase/tests/NN_name.test.sql`
   (`tests.create_user`, `tests.add_staff(practice, user, role, sites)`,
   `tests.login(id[, 'aal2'])`, `tests.anon()`, `tests.ok/is/throws`). Cover:
   the allowed role, a disallowed role, another practice, another site,
   `aal1` when MFA is required, deactivated staff, unverified clinicians and
   anonymous callers. See `06_tenancy_foundation.test.sql`.
7. **Idempotent migrations** with a header comment (what and why).
8. **Pricing labels:** when you ship a `soon("…")` feature in `Pricing.tsx`,
   make it a plain string in the same PR.
9. **Legal pages:** change only config facts without legal sign-off.

---

## Task A: finish the Increment 1 leftovers

Small, separate fixes. Do these first, in one PR.

| # | Fix | Files | Done when |
|---|---|---|---|
| A1 | Patient portal overview | `src/components/dashboards/PatientDashboard.tsx` | Stat cards and upcoming appointments come from `appointments` filtered by `myPortalPatientIds(user.id)` (`src/lib/booking.ts`), with times via `formatDate`/`formatTime(iso, provider timezone)`. The "Health Score" card is gone (no data source; misleading). Empty states say what to do next. |
| A2 | Patient medical records | `src/components/patient/MedicalRecords.tsx` | The hardcoded records, prescriptions and allergies are replaced with real rows from `medical_records` and `prescriptions` for `myPortalPatientIds`. RLS already limits portal users to verified links. Allergies: show "Ask your practice" until Increment 3 adds an allergies table. No View/Download buttons that do nothing. |
| A3 | Super-admin screens | `src/components/dashboards/SuperAdminDashboard.tsx`, `src/components/admin/{SubscriptionManagement,PaymentsModule,ClaimsMonitoring,UserManagement}.tsx` | No made-up numbers: real counts where a platform-level query exists (e.g. practices, verifications), otherwise "Coming soon". **Do not** give `super_admin` access to patients or clinical tables again; platform admins see practice-level counts only (add a `SECURITY DEFINER` function returning aggregates if needed, with tests). |
| A4 | Nurses see clinical notes | `src/pages/practice/StaffWorkspace.tsx`, `src/components/doctor/PatientRecords.tsx`, `PrescriptionManager.tsx` | Nurses get read-only Notes and Prescriptions tabs filtered by `practice_id` (they have no `provider_id`). Create/edit stays with clinicians. RLS already allows nurse reads. |
| A5 | Small fixes | `src/components/Footer.tsx`, `src/components/Header.tsx`, `src/integrations/supabase/client.ts`, `src/components/{doctor,patient,admin}/` | Footer: remove every `href="#"` link and the placeholder `+27 (0) 11 123 4567`. Header: remove the dead "Profile" menu item. Client: render a clear "app not configured" screen instead of `throw` at import. Every icon-only button has an `aria-label`. |

---

## Task B: Increment 2, front desk (build-ready)

Goal from the PRD (FR-03): reception runs the day from one diary; a visit goes
booked → checked in → in room → done, or cancelled / no-show.

### B1. Migration `supabase/migrations/20261126090000-front-desk.sql`
- **Appointment status** as a checked set: `booked`, `checked_in`, `in_room`,
  `completed`, `cancelled`, `no_show`. Convert existing `scheduled` →
  `booked` (default becomes `booked`). Update `book_appointment`,
  `cancel_my_appointment` and every place in `src/` that writes or compares
  `scheduled`.
- **New columns on `appointments`:** `ends_at TIMESTAMPTZ NOT NULL`
  (backfill `appointment_date + 30 min`, check `ends_at > appointment_date`),
  `checked_in_at`, `in_room_at`, `completed_at`, `cancelled_reason TEXT`,
  `booked_by UUID`.
- **`provider_availability`:** `practice_id`, `provider_id`, `site_id`,
  `weekday 0–6`, `start_time`, `end_time` (practice-local wall-clock times),
  plus **`availability_exceptions`** (`provider_id`, `date`, optional times,
  `reason`) for leave and closures. RLS: members read; owner/manager write;
  a clinician may edit their own. Add both tables to `enforce_same_practice`
  and `audit_row_change`.
- **Clash rules (in the database, not the UI):** a provider can't have
  overlapping active appointments; a room with `exclusive = true` can't
  either. "Active" means not `cancelled`/`no_show`. Enforce with a
  `pg_advisory_xact_lock` **per provider and per room** (today's lock in
  `book_appointment` is per provider + exact start time, which doesn't catch
  overlapping durations), then an overlap check. Consider an exclusion
  constraint (`btree_gist`) as a second line.
- **Functions** (`SECURITY DEFINER`, `search_path = ''`, revoked from
  anon, audited via `write_audit_event`):
  - `staff_book_appointment(_patient_id, _provider_id, _site_id, _room_id,
    _starts_at, _minutes, _type, _reason)`: owner, manager, receptionist,
    nurse, clinician with site access (`can_access_row`); patient, provider,
    site and room must be in the same practice; walk-in = `_starts_at` now.
    Errors: `SLOT_TAKEN`, `ROOM_TAKEN`, `OUTSIDE_AVAILABILITY` (front desk
    may override with `_force := true`; record that in the audit metadata),
    `NOT_ALLOWED`.
  - `reschedule_appointment(_id, _starts_at, _minutes, _room_id)`: same
    rules; only `booked` appointments.
  - `set_appointment_status(_id, _status, _reason)`: allowed transitions
    only: booked→checked_in/cancelled/no_show; checked_in→in_room/cancelled;
    in_room→completed. Sets the timestamp columns. `cancelled` needs a reason.
  - `practice_diary(_practice_id, _from, _to, _site_id)`: appointments with
    patient name, provider and room for the diary, scope-checked.
- The portal's `book_appointment` must respect availability and the new clash
  rules.
- **Tests** `supabase/tests/07_front_desk.test.sql` (use `tests.add_staff`,
  `tests.login(id, 'aal2')`): each role allowed/denied; other practice;
  other site; `aal1` with MFA required; deactivated staff; provider clash with
  overlapping (not equal) times; exclusive vs shared room; every allowed and
  disallowed transition; cancel without reason; availability and override;
  anon. Concurrency: `supabase/tests/concurrency/room_race.sh` (two
  bookings for one exclusive room at overlapping times → exactly one wins).
  Run all earlier suites too; the 164 existing checks must stay green.
- Update `src/integrations/supabase/types.ts`.

### B2. UI
- **Diary tab** (`src/components/practice/Diary.tsx`, front desk and
  clinicians): day view by provider (columns) with a week toggle; site
  filter; times in the practice time zone (`zonedTimeToDate`,
  `formatTime`, `todayIn`). Click an empty slot → book dialog (patient
  search reusing the `PatientRegistry` query, provider, room, length,
  reason). Click an appointment → reschedule, cancel (reason), status.
- **Today tab** (`src/components/practice/TodayQueue.tsx`): today's
  appointments grouped Waiting to arrive / Checked in / In room / Done, with
  one-tap buttons for the allowed next status and "Walk-in". Times show as
  practice-local.
- **Patient sheet:** "Book appointment" button in `PatientDetailSheet`.
- **Availability:** owners/managers edit weekly hours and exceptions per
  provider in a new admin tab; clinicians edit their own.
- **Doctor screens:** `AppointmentScheduler` status buttons call
  `set_appointment_status`; labels follow the new statuses.
- Map every new error code in `practiceErrorMessage` / `bookingErrorMessage`.
- Phone layout: the diary becomes a single-provider list with a provider
  picker at 390px.

### B3. What the PR must show
`scripts/test-db.sh` green (all files), `npm test`, `tsc`, `npm run lint`
(0 errors), `npm run build`, and screenshots of Diary, Today and the book
dialog at 390px and desktop, light and dark. Add vitest tests for any new
time/slot helper (e.g. overlap or slot generation in another time zone).

---

## Later increments (don't start yet)

| # | Scope | Notes |
|---|---|---|
| 3 | **Encounters:** vitals, allergies, ICD-10 diagnoses, notes with versions/sign/amend, documents, printable prescription/referral | Decide nurse write rights |
| 4 | **Billing + cashier:** effective-dated tariffs per country/currency, invoice lines with tariff snapshots, idempotency keys, credit notes, payments, allocations, cashier sessions, daily close | `invoices.currency` defaults from the practice |
| 5 | **Claims:** manual claim tracking per invoice line, statuses, deadlines, rejections, exports, scheme catalogue per country | |
| 6 | **Messaging + tasks:** outbox + worker (a container on the Azure VM, or self-hosted Edge Functions; `pg_cron` in our Postgres), SMS/email per country, reminders, delivery log | Also email staff invitations (today the link is copied by hand) |
| 7 | **Reports + data:** reports that reconcile to source, import dry-run, cutover reconciliation, portability export | |

Telehealth video still has no provider: keep "Video coming soon".

---

## How to hand back

- One PR per task, branched from `main`.
- The PR description lists: migrations to apply (in order), any Auth/server
  settings to change, and founder decisions needed.
- Never describe the product as "compliant"; say "built with POPIA and the
  Botswana DPA in mind". Update `docs/compliance/REGULATORY_READINESS.md` when
  a row's status really changes.
- When a feature tagged `soon("…")` in `src/components/Pricing.tsx` ships,
  make it a plain string in the same PR.
- If a rule here blocks you, stop and explain in the PR rather than weakening
  RLS or a helper.

---

## UI conventions (keep mobile working)

- Page padding: `px-4 sm:px-6`. Cards hold lists as
  `divide-y divide-border rounded-lg border` rows that stack on phones
  (`flex flex-col sm:flex-row`).
- Top-level tabs scroll sideways on phones (see `StaffWorkspace`).
- Dialogs: `max-h-[90vh] overflow-y-auto`; detail views use `Sheet`.
- Use theme tokens (`bg-background`, `text-muted-foreground`, …) or `dark:`
  variants.
- Check every new screen at 390px wide and on desktop, in light and dark mode.
