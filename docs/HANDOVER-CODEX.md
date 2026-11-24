# Handover: building on the practice platform

Clinithetics is a React + Vite + Supabase **practice management system** for
independent clinics in **Botswana and South Africa**. Reception, nurses,
clinicians, billers and managers work on one shared patient record per
practice. A patient portal runs alongside it.

The product plan is in the PRD (Draft v1.0, 24 Nov 2026). Increment 1
(foundation) is done. Read **Ground rules** before touching the database.

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

**Database migrations.** The founder applies migrations by hand in the
Supabase SQL Editor, in filename order. Increment 1 adds
`20261125090000-tenancy-foundation.sql`. **It wipes test rows in
appointments, medical records, prescriptions and invoices** on its first run
(there is no production data yet). After applying it:
- enable **TOTP MFA** in Supabase Auth settings;
- regenerate `src/integrations/supabase/types.ts` (or edit by hand).

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

## Next increments (from the PRD)

| # | Scope | Notes |
|---|---|---|
| 2 | **Front desk:** diary per provider and room, walk-ins, reschedule/cancel, check-in, no-show, Today/waiting queue, staff booking for any patient | Reuse `book_appointment`'s advisory lock; rooms with `exclusive` can't double-book |
| 3 | **Encounters:** vitals, allergies, ICD-10 diagnoses, notes with versions/sign/amend, documents, printable prescription/referral | Nurses read clinical notes today; decide their write rights |
| 4 | **Billing + cashier:** effective-dated tariffs per country/currency, invoice lines with tariff snapshots, idempotency keys, credit notes, payments, allocations, cashier sessions, daily close | `invoices.currency` defaults from the practice |
| 5 | **Claims:** manual claim tracking per invoice line, statuses, deadlines, rejections, exports, scheme catalogue per country | |
| 6 | **Messaging + tasks:** outbox + worker (Edge Function + `pg_cron`), SMS/email per country, reminders, delivery log | Also send staff invitations by email (today the link is copied by hand) |
| 7 | **Reports + data:** reports that reconcile to source, import dry-run, cutover reconciliation, portability export | |

Known gaps left from Increment 1:
- `SuperAdminDashboard` and its admin modules still show hardcoded numbers;
  platform admins no longer have blanket access to clinical tables by design.
- `PatientDashboard` overview and `patient/MedicalRecords.tsx` still need
  re-pointing to portal links (the Appointments, Telehealth and Payments tabs
  are done).
- Doctor create/edit buttons in `AppointmentScheduler`, `PatientRecords`,
  `PrescriptionManager` still do nothing (Increments 2–3).
- Nurses (no provider record) don't get the clinical tabs yet.
- Telehealth video has no provider; keep "Video coming soon".

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
