# Handover: functional work for Codex

Clinithetics is a React + Vite + Supabase EMR and billing app for practices in
South Africa and Botswana. The visual, UX, legal-page and security groundwork
is done. What remains is **functional**: wiring up buttons that do nothing and
replacing hardcoded demo data with real data.

Read the **Ground rules** before changing anything that touches the database.

---

## Current state (don't redo)

**UI**
- Responsive dashboards (icon-only header buttons on phones, tab rows scroll
  sideways, grid "tables" scroll inside their card, stat cards 2-up on phones).
- Dark mode via `next-themes` with a branded palette in `src/index.css` and a
  `ThemeToggle` on every header. Use theme tokens (`bg-background`,
  `text-muted-foreground`, …) or add `dark:` variants for hardcoded colours.
- Landing CTAs open `/auth?mode=signup&role=doctor|patient`.
- Landing claims are honest: no user counts or testimonials; POPIA & DPA
  "built for", never "compliant". Unbuilt plan features are tagged
  `soon("…")` in `src/components/Pricing.tsx`.
- `/privacy` and `/terms` use `src/components/legal/LegalPage.tsx`; business
  facts live in `src/content/companyConfig.ts`, `privacyPolicyConfig.ts` and
  `termsConfig.ts` (unset values render as "To confirm" markers).

**Security and data**
- Sign-up can only self-select `patient` or `doctor`; `super_admin` is granted
  by hand.
- **Doctor verification:** `doctor_verifications` (HPCSA/BHPC, status,
  certificate). Every doctor RLS policy requires
  `public.is_verified_doctor(auth.uid())`. Unapproved doctors see
  `DoctorVerificationGate`; admins review in the **Verifications** tab.
  Certificates are in the private `doctor-certificates` bucket under
  `<doctor id>/`, opened only via 60-second signed URLs (`openCertificate`).
- **Patient booking is real** (`AppointmentBooking.tsx`), via server-side
  functions `list_bookable_doctors`, `doctor_booked_slots`, `book_appointment`
  (in-person only, double-booking safe) and `cancel_my_appointment`.
- **Doctors see their patients' names and emails** via
  `doctor_patient_profiles(ids)` and `fetchPatientContacts`
  (`src/lib/doctorPatients.ts`).
- **Telehealth is honest:** no video provider yet. Both telehealth tabs show
  real telehealth appointments tagged "Video coming soon", a
  `VideoComingSoon` notice, and a working camera/microphone check
  (`src/components/telehealth/DeviceCheck.tsx`). `vercel.json` allows
  `camera=(self), microphone=(self)`.

---

## Before you start

**Database migrations.** The founder applies migrations by hand in the
Supabase SQL Editor, so production may lag the repo. Apply in this order:

1. `20261123180000-restrict-signup-roles.sql`
2. `20261123200000-doctor-verification.sql`
3. `20261123210000-doctor-certificates.sql`
4. `20261124090000-patient-booking.sql`
5. `20261124110000-doctor-patient-names.sql`

The app degrades gracefully when a migration is missing (see
`isVerificationTableMissing` in `src/lib/doctorVerification.ts` and
`isBookingNotSetUp` in `src/lib/booking.ts`). Do the same for new migrations:
show an honest "not available yet" state, never a broken screen.

**Run locally.** The Supabase client throws on load without env vars, so
create `.env.local`:

```
VITE_SUPABASE_URL=<project url>
VITE_SUPABASE_ANON_KEY=<anon key>
```

```bash
npm install
npm run dev
```

**Before every PR:** `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`
(26 existing problems; don't add new ones), `npm run build`.

**Schema.** Tables: `profiles`, `user_roles`, `doctor_profiles`,
`patient_profiles`, `appointments`, `medical_records`, `prescriptions`,
`invoices`, `doctor_verifications`. Types are in
`src/integrations/supabase/types.ts`; update them by hand when you add tables
or functions. There are **no tables yet** for subscriptions, platform
payments/payouts or medical-aid claims.

---

## Ground rules

1. **Never show success for something that didn't happen.** Show a success
   message only after the database confirms; otherwise show a clear error.
   Until a feature works, hide its button or mark it "Coming soon".
2. **Enforce access in the database, not just the UI.** Anyone can call
   Supabase directly with the public anon key.
   - Never derive roles or permissions from `user_metadata`.
   - New doctor-facing policies must require `public.is_verified_doctor(auth.uid())`.
   - Prefer narrowly scoped `SECURITY DEFINER` functions (with
     `SET search_path = ''`, `REVOKE … FROM PUBLIC, anon`, and checks on
     `auth.uid()`) over widening table policies. Return only the columns a
     screen needs.
   - Don't query `profiles` directly for other users, and don't widen its RLS.
3. **Test RLS changes against a real Postgres**: apply all migrations on a
   scratch database with a minimal `auth` schema (`auth.users`, `auth.uid()`
   reading `request.jwt.claim.sub`), then run queries as `SET ROLE
   authenticated` with different users. Cover the allowed case, the
   cross-user case, unverified doctors and anonymous callers.
4. **Make migrations idempotent** (`CREATE OR REPLACE`, `IF NOT EXISTS`,
   `DROP POLICY IF EXISTS`), with a header comment saying what it does and
   what it requires.
5. **Pricing labels:** when you ship a feature tagged `soon("…")` in
   `Pricing.tsx`, make it a plain string in the same PR.
6. **Legal pages:** don't change policy or terms wording without legal
   sign-off; only the config facts.

---

## Tasks, in priority order

### 1. Wire up the core doctor actions
Files in `src/components/doctor/` read real data, but their create/edit
buttons do nothing.

| Component | Buttons to implement | Database note |
|---|---|---|
| `AppointmentScheduler.tsx` | New Appointment, per-row status change (completed / no-show / cancelled), edit | **Doctors have no INSERT policy on `appointments`.** Add a `SECURITY DEFINER` function like `book_appointment`, for a patient the doctor already treats, reusing the same double-booking lock. Doctors already have an UPDATE policy. |
| `PatientRecords.tsx` | New Record (dialog + insert into `medical_records`), View, Edit | The existing `FOR ALL` policy only checks `doctor_id = auth.uid()` and verification, not that the patient belongs to the doctor. Restrict inserts to patients with a care relationship, like `doctor_patient_profiles`. |
| `PrescriptionManager.tsx` | New Prescription, View, Edit, Refill/Cancel | Same patient-relationship gap as medical records. |

Use the existing `Dialog`, `Form` (react-hook-form + zod) and toast components
in `src/components/ui/`. Validate with zod, show success or failure, and
refresh the list after a write.

### 2. Replace hardcoded data with real data
- `src/components/dashboards/DoctorDashboard.tsx` Overview: `todayStats`,
  `upcomingAppointments`, "Recently Seen Patients". Derive them from the
  doctor's appointments, records, prescriptions and invoices (patient names via
  `fetchPatientContacts`). Today the overview says "12 appointments" while the
  Appointments tab says 0.
- `src/components/dashboards/PatientDashboard.tsx` Overview: stat cards,
  upcoming appointments (reuse the booking functions and `src/lib/booking.ts`),
  recent activity. **Remove the "Health Score" card**: it has no data source
  and is misleading in a clinical product.
- `src/components/patient/MedicalRecords.tsx`: records, prescriptions,
  allergies (from `medical_records`, `prescriptions`, `patient_profiles`), and
  the View/Download buttons.
- `src/components/patient/PaymentHistory.tsx`: check it against `invoices`.
  Payments aren't implemented, so don't show "Pay" actions that do nothing.
- `src/components/dashboards/SuperAdminDashboard.tsx`: overview stats and
  activity feed.

Empty lists get a friendly empty state with the next action, e.g. "No
appointments yet. Book one."

### 3. Telehealth video (needs a provider decision from the founder)
When a provider is chosen (e.g. Daily, Twilio, Jitsi):
- Add its origins to the CSP in `vercel.json` (`connect-src`, `frame-src`,
  `media-src` as needed). If it runs in an iframe, delegate permissions with
  `camera=(self "https://provider.origin")` and `allow="camera; microphone"`.
- Reuse `DeviceCheck` as the pre-call check.
- Let patients book telehealth appointments (`book_appointment` is
  in-person only).
- Add consultation notes (persist to `medical_records.consultation_notes`).
- Remove the "Video coming soon" tags and the `soon()` pricing labels for
  telehealth.

### 4. Admin modules (needs schema work first)
`SubscriptionManagement.tsx`, `PaymentsModule.tsx` and `ClaimsMonitoring.tsx`
are entirely hardcoded, with no tables behind them. Propose migrations with
RLS restricted to `super_admin` (via `has_role`) before building UI. Until
then, hide or mark "Coming soon" the buttons that do nothing: Export, Filter,
View, Edit, Retry, Refund, Process Payout, Approve, Reject.
`UserManagement.tsx`: Add New User and per-row actions.

### 5. Small fixes
- `src/components/Header.tsx`: "Profile" menu item has no action. Add a
  profile page or remove it.
- `src/components/Footer.tsx`: 9 product/support links still use `href="#"`.
  Hide them until the pages exist. The phone number `+27 (0) 11 123 4567`
  looks like a placeholder; confirm with the founder or remove it.
- `src/integrations/supabase/client.ts`: render a clear configuration error
  screen instead of throwing at import time.
- Icon-only buttons in `doctor/`, `patient/` and `admin/` need an `aria-label`.

### Open compliance items (founder / legal, not code)
See `docs/compliance/REGULATORY_READINESS.md`: audit logging, retention
periods, Information Officer / DPO, hosting region and cross-border transfers,
breach response plan. Audit logging is engineering work once the founder
confirms scope.

---

## UI conventions (keep mobile working)

- Page padding: `p-4 sm:p-6`.
- Stat card grids: `grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4`.
- List rows with actions:
  `flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg`.
- Search + button bars: `flex flex-col sm:flex-row gap-3 sm:gap-4`.
- Grid "tables": wrapper `border rounded-lg overflow-x-auto`, each row
  `grid grid-cols-N ... min-w-[NNrem]`.
- Top-level tab lists:
  `flex w-full justify-start overflow-x-auto md:grid md:grid-cols-N`.
  `TabsList` in `src/components/ui/tabs.tsx` already scrolls sideways.
- Check every new screen at 390px wide (iPhone) and on desktop, in light and
  dark mode. Nothing should stick out past the card or the page edge.
