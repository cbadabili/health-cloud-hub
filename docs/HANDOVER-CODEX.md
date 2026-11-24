# Handover: functional work for Codex

The visual and UX polish pass is done (see "Already done" below). This brief
covers the **functional** work that remains: making buttons do things and
replacing hardcoded demo data with real data from Supabase.

Please keep the visual patterns described under "UI conventions" when you add
or change screens, so mobile does not regress.

---

## Already done (don't redo)

- Dashboard headers and tabs are responsive (icon-only header buttons on
  phones, tab rows scroll sideways).
- Wide "tables" (CSS-grid rows) scroll inside their card on phones.
- List rows stack vertically on phones; stat cards are 2-up on phones.
- Landing-page CTAs open `/auth?mode=signup&role=doctor|patient`, and the
  auth page preselects the tab and role from the query string.
- Dashboard greetings use `user_metadata.first_name` / `last_name`.

---

## How to run locally

The Supabase client throws on load if its env vars are missing (the whole
site goes blank), so create `.env.local`:

```
VITE_SUPABASE_URL=<project url>
VITE_SUPABASE_ANON_KEY=<anon key>
```

```bash
npm install
npm run dev
```

Checks before every PR: `npx tsc -p tsconfig.app.json --noEmit`,
`npm run lint`, `npm run build`.

Database tables that exist today (`src/integrations/supabase/types.ts`,
migrations in `supabase/migrations/`): `profiles`, `user_roles`,
`doctor_profiles`, `patient_profiles`, `appointments`, `medical_records`,
`prescriptions`, `invoices`. There are **no tables yet** for subscriptions,
platform payments/payouts, or medical-aid claims.

---

## Tasks, in priority order

### 0. Security fixes first (see `docs/compliance/REGULATORY_READINESS.md` §5)
- **Done:** the `super_admin` sign-up hole is fixed by
  `supabase/migrations/20261123180000-restrict-signup-roles.sql` (only
  `patient`/`doctor` can be self-selected). Never derive roles from
  `raw_user_meta_data` / `user_metadata` again. `super_admin` is granted by
  hand only.
- **Done:** `vercel.json` now allows `camera=(self), microphone=(self)`.

- **Done:** doctor verification (`doctor_verifications` table, approved-only
  doctor RLS, admin Verifications tab, holding screen for unapproved doctors).
  Any new doctor-facing policy must also require
  `public.is_verified_doctor(auth.uid())`. Certificates live in the private
  `doctor-certificates` bucket under `<doctor id>/`. Never make it public, and
  open files only via signed URLs (`openCertificate` in
  `src/lib/doctorVerification.ts`).

### 0b. Telehealth video is not implemented yet
`src/components/doctor/TelehealthSession.tsx` and
`src/components/patient/TelehealthAccess.tsx` only toggle UI state. No
`getUserMedia` or video provider exists, the "Ready" system checks are
hardcoded, and the patient Telehealth tab's "Join Session" buttons go nowhere.
Patient booking currently creates in-person appointments only. When adding a provider (e.g. Daily, Twilio, Jitsi):
- add its origins to the CSP in `vercel.json` (`connect-src`, `frame-src`,
  `media-src` as needed);
- if it runs in an iframe, delegate permissions with
  `camera=(self "https://provider.origin")` and the iframe's
  `allow="camera; microphone"`;
- make the system check call `navigator.mediaDevices.getUserMedia` for real.

### Pricing labels
`src/components/Pricing.tsx` marks unbuilt plan features with `soon("...")`
("Coming soon"). When you ship one of them (e.g. telehealth video, PMB claims,
analytics, API access), change it back to a plain string in the same PR.
Never advertise a feature that customers can't use yet.

### 1. Wire up the core doctor actions
Files in `src/components/doctor/` already read from Supabase, but their
create/edit buttons have no handlers.

| Component | Buttons to implement |
|---|---|
| `AppointmentScheduler.tsx` | New Appointment (dialog + insert into `appointments`), per-row edit / status change, table row actions |
| `PatientRecords.tsx` | New Record (dialog + insert into `medical_records`), View, Edit |
| `PrescriptionManager.tsx` | New Prescription (insert into `prescriptions`), View, Edit, Refill/Cancel row actions |
| `TelehealthSession.tsx` | Save Notes (persist to `medical_records.consultation_notes` for that appointment) |

Use the existing `Dialog`, `Form` (react-hook-form + zod) and `useToast`
components in `src/components/ui/`. Validate input with zod. Show a toast on
success and failure, and refresh the list after a write.

### 2. Replace hardcoded data with real data
These screens show static arrays that look real but aren't:

- `src/components/dashboards/DoctorDashboard.tsx`: `todayStats`,
  `upcomingAppointments` and the "Recently Seen Patients" list. Derive them
  from `appointments`, `medical_records`, `prescriptions` and `invoices` for
  the signed-in doctor. Today the overview says "12 appointments" while the
  Appointments tab (real data) says 0.
- `src/components/dashboards/PatientDashboard.tsx`: stat cards, upcoming
  appointments, recent activity. **Remove the "Health Score" card**; it has no
  data source and is misleading in a clinical product.
- **Done:** `src/components/patient/AppointmentBooking.tsx` uses real data via
  `supabase/migrations/20261124090000-patient-booking.sql`
  (`list_bookable_doctors`, `doctor_booked_slots`, `book_appointment`,
  `cancel_my_appointment`, all validated server-side). Reuse these functions
  for the patient Overview tab's upcoming appointments, which are still
  hardcoded.
- `src/components/patient/MedicalRecords.tsx`: records, prescriptions,
  allergies (read from `medical_records`, `prescriptions`,
  `patient_profiles`). View/Download buttons.
- `src/components/patient/TelehealthAccess.tsx`: upcoming and past sessions.
- `src/components/dashboards/SuperAdminDashboard.tsx`: overview stats and
  activity feed.

When a list is empty, show a friendly empty state with a primary action
(e.g. "No appointments yet: Book one"), not just "No X found".

### 3. Admin modules (needs schema work first)
`src/components/admin/SubscriptionManagement.tsx`, `PaymentsModule.tsx` and
`ClaimsMonitoring.tsx` are entirely hardcoded, and no tables back them.
Propose migrations (with RLS restricted to `super_admin` via the existing
`has_role` function) before building the UI. Buttons waiting on this:
Export, Filter, View, Edit, Retry, Refund, Process Payout, Approve, Reject.
`UserManagement.tsx`: Add New User and per-row actions.

**Until a feature is wired up, hide its button or disable it with a "Coming
soon" tooltip.** Buttons that do nothing when clicked damage trust.

### 4. Small fixes
- `src/components/Header.tsx`: the "Profile" menu item has no action. Add a
  basic profile page or remove the item.
- `src/components/Footer.tsx`: 9 product/support links still use `href="#"`;
  hide them until the pages exist. Privacy Policy, Cookie Policy, POPIA & DPA
  and Terms of Service go to `/privacy` and `/terms`. Their business facts live
  in `src/content/companyConfig.ts`, `privacyPolicyConfig.ts` and
  `termsConfig.ts`; don't edit the legal wording without legal sign-off. Both
  pages use the shared layout in `src/components/legal/LegalPage.tsx`.
- `src/integrations/supabase/client.ts`: render a clear configuration error
  screen instead of throwing at import time.
- Icon-only buttons in `doctor/`, `patient/` and `admin/` components need an
  `aria-label`.

### 5. Landing-page claims (done, for reference)
The unverifiable claims ("10,000+ users", "100% Secure", named testimonials)
were removed, and HIPAA wording was replaced with POPIA & DPA. Copy says
"built for" / "in mind", **not** "compliant": audit logging and a formal risk
assessment are still open (see `docs/compliance/REGULATORY_READINESS.md`).
Don't add compliance, user-count or testimonial claims without sign-off.

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
  `TabsList` in `src/components/ui/tabs.tsx` already scrolls sideways on
  overflow.
- Check every new screen at 390px wide (iPhone) as well as desktop. Nothing
  should stick out past the card or the page edge.
