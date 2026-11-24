# Regulatory Readiness: POPIA (South Africa) & DPA (Botswana)

**Status:** working baseline, last reviewed 23 November 2026.
**This is not legal advice.** It maps what the codebase does today against
the main data-protection obligations for a health platform serving South
Africa and Botswana, so we know what is done and what is left. Points marked
**[verify]** come from secondary sources that disagree or that we could not
check against the official text. Confirm them with counsel before relying on
them.

> **Claims rule:** until the "Before claiming compliance" list below is
> complete, public copy may say "built for POPIA & DPA" or "with POPIA & DPA
> in mind", but **not** "POPIA compliant" or "DPA compliant".

---

## 1. Laws in scope

| Law | Applies to | Notes |
|---|---|---|
| **Protection of Personal Information Act 4 of 2013 (POPIA)**, South Africa | Personal information of South African patients, doctors and staff | Health information is *special personal information* (s 26). |
| **POPIA Regulations on the processing of health information** | Health data under POPIA | Published in Government Gazette No. 54268 and in force from **6 March 2026**, with no grace period. They give more detailed rules under s 32(6). |
| **National Health Act 61 of 2003 (s 14) and HPCSA guidelines**, including telehealth | SA healthcare providers using the platform | Confidentiality of patient records. Where the POPIA s 32 healthcare exemption applies, providers remain bound by these. |
| **Data Protection Act, 2024 (Act No. 18 of 2024), Botswana ("DPA")** | Personal data of people in Botswana | Commenced **14 January 2025**. The Information and Data Protection Commission (IDPC) continues as regulator. Sources say it replaces the 2018 Act **[verify that the 2018 Act was expressly repealed]**. |
| Medical Schemes Act 131 of 1998 (SA) | PMB claims features | Relevant once claims processing is real; out of scope for this baseline. |

## 2. Our role under each law **[verify with counsel]**

The legal role decides who carries which obligation, and it affects contracts.

- **Practices (doctors, clinics)** decide why and how patient health data is
  processed. They are most likely the **responsible party** (POPIA) or
  **controller** (DPA) for patient records.
- **Clinithetics** stores and processes that data for them, so for that data
  it is most likely an **operator** (POPIA) or **processor** (DPA). That
  requires a written agreement with each practice covering security
  (POPIA s 20–21).
- **But** patients and doctors also sign up directly with Clinithetics, and we
  hold account, billing and subscription data in our own right. For that data
  Clinithetics is a **responsible party / controller**, with the full set of
  obligations.

---

## 3. What the code already does

| Control | Where | Notes |
|---|---|---|
| Authentication required for the app | `ProtectedRoute.tsx`, Supabase Auth | `/dashboard` redirects unauthenticated users to `/auth`. |
| Session kept in `sessionStorage` | `src/integrations/supabase/client.ts` | Login is cleared when the browser closes. |
| No credentials in source | Supabase client | URL and anon key come from env vars. |
| Strong password policy | `src/pages/Auth.tsx` | 12+ characters, mixed case, a number and a symbol. |
| **Row-Level Security on all 8 data tables** | `supabase/migrations/20250708151353-*.sql` | `profiles`, `user_roles`, `doctor_profiles`, `patient_profiles`, `appointments`, `medical_records`, `prescriptions`, `invoices` all have RLS enabled, with policies scoping patients to their own rows and doctors to their own patients. |
| HTTPS and browser security headers | `vercel.json` | HSTS (2 years, preload), CSP, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy. |
| Generic sign-up errors | `src/pages/Auth.tsx` | Avoids revealing whether an account exists. |

---

## 4. Requirement map

Status: ✅ in place · 🟡 partial · ❌ gap

POPIA section numbers are given. DPA section numbers are left out where
sources disagree **[verify]**.

| Obligation | POPIA | DPA (Botswana) | Status | What exists / what's missing |
|---|---|---|---|---|
| **Lawful basis for health data** | s 11; s 26 prohibition with s 32 exemption for healthcare providers; 2026 health regulations | Sensitive data is prohibited by default, with listed conditions that allow it **[verify that health data is listed]** | 🟡 | The platform assumes practices process under the healthcare exemption. There is no record of which basis applies per practice, and no patient consent capture. |
| **Purpose & minimality** | s 10, 13, 15 | Purpose limitation & minimisation | 🟡 | Role-based dashboards limit what each role sees. No documented purposes, and some fields are broader than needed (e.g. free-text medical history). |
| **Openness / privacy notice** | s 17–18 | Transparency duties | 🟡 | Draft privacy policy at `/privacy` (`src/pages/PrivacyPolicy.tsx`), linked from the footer and sign-up page. Business facts still to fill in are in `src/content/privacyPolicyConfig.ts` and show as "To confirm" until set. Needs legal review. No consent step at patient sign-up yet. |
| **Access control** | s 19 | Security safeguards | 🟡 | Access is per practice and per role (owner, manager, receptionist, nurse, clinician, biller), optionally limited to sites, and enforced by row-level security in the database. Removing a staff role stops access on the next request. Staff must use **two-step sign-in (TOTP)** when the practice requires it (on by default). Clinicians also need an approved registration check (§5.2). Platform admins no longer have blanket access to clinical records. Still missing: session timeouts and a periodic access review. |
| **Security safeguards (encryption, integrity)** | s 19 | Security safeguards | 🟡 | TLS and HSTS in transit. Encryption at rest is handled by the database host **[confirm on our Supabase plan]**. No field-level encryption for clinical notes. |
| **Audit trail** | s 19 (accepted practice); 2026 health regulations | Accountability | 🟡 | Append-only `audit_events` log: who created, changed or deleted patients, contacts, portal access, staff roles, invitations, appointments, notes, prescriptions and invoices, plus every time a patient record is opened and every merge (with reason). Entries hold ids and changed field names, never record contents, and can't be edited or deleted. Owners and managers can read it in the app. Still missing: exports (none exist yet), failed-access logging, retention period for the log itself. |
| **Operator / processor agreements** | s 20–21 | Processor contracts | ❌ | No template agreement between Clinithetics and practices. No signed agreements with our own sub-processors (Supabase, Vercel). |
| **Breach notification** | s 22: Regulator and data subjects "as soon as reasonably possible". Reported through the Information Regulator's eServices portal (mandatory since 1 April 2025). | Notify the IDPC within **72 hours** of becoming aware, unless the breach is unlikely to create a risk; notify affected people without undue delay **[verify]** | ❌ | No incident response plan, owner or contact list. |
| **Data subject rights (access, correction, deletion)** | s 23–25 | Access, rectification, erasure, objection | 🟡 | Patients can view their records in the portal. No export, correction request or deletion flow. |
| **Retention & deletion** | s 14 | Storage limitation | ❌ | No retention periods or automatic deletion. This includes doctor registration certificates in the `doctor-certificates` bucket. Note: health record retention rules (e.g. HPCSA guidance) may require keeping records for years. Define per record type. |
| **Information Officer / DPO** | s 55–56: register the Information Officer with the Information Regulator | A DPO is required for large-scale processing of sensitive data; sources disagree on whether to register or notify the IDPC **[verify]** | ❌ | No named officer for either country. |
| **Cross-border transfers** | s 72. Prior authorisation (s 57) may be needed to send special personal information to a country without adequate protection. | Transfers outside Botswana are restricted. Sources say **a copy must remain in Botswana**, and sensitive data may need prior Commission approval **[verify]** | ❌ | **Hosting region unknown.** If Supabase or Vercel store data outside SA or Botswana, these rules apply. The Botswana copy requirement could need an in-country replica. |
| **Accountability / documentation** | s 8 | Accountability | ❌ | No processing register, risk assessment or policies. |

---

## 5. Critical issues to fix first

### 5.1 Anyone could sign up as `super_admin` ✅ fixed in code, must be applied to production
**Fixed by** `supabase/migrations/20261123180000-restrict-signup-roles.sql`
(tested against Postgres 16: before the fix a `super_admin` sign-up got
`super_admin`; after it, every non-`doctor` value, including `SUPER_ADMIN`,
becomes `patient`). The migration must be **run on the production database**,
and existing roles audited:

```sql
SELECT r.user_id, p.email, r.created_at
FROM public.user_roles r JOIN public.profiles p ON p.user_id = r.user_id
WHERE r.role = 'super_admin';
```

Original finding:
`supabase/migrations/20250711072229-*.sql` (`handle_new_user`) sets the new
user's role straight from sign-up metadata:

```sql
COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'patient')
```

The website only offers "patient" or "doctor", but the metadata is
client-controlled. Anyone with the public anon key can call `signUp` with
`role: 'super_admin'` and get the "Super admins can manage all …" RLS
policies, which means full read and write access to every patient's records.

**Fix:** only accept `patient` or `doctor` from sign-up. Anything else becomes
`patient`. Assign `super_admin` only by hand or through a privileged server
function. Then audit existing `user_roles` rows for unexpected
`super_admin` entries.

### 5.2 Doctors were not verified ✅ fixed in code, must be applied to production
Any sign-up could choose "doctor" and immediately get doctor access.
`supabase/migrations/20261123200000-doctor-verification.sql` adds
`doctor_verifications` (council HPCSA/BHPC, registration number, status) and
makes **every doctor RLS policy require an approved verification**. Patients
only see, and can only book with, verified doctors. Doctors submit details at
sign-up or on a holding screen; only super_admins approve or reject them, in
the admin **Verifications** tab, and each decision is stamped with who made it
and when. Tested on Postgres 16 with RLS (14 checks), including attempted
self-approval.

**Certificates** (`20261123210000-doctor-certificates.sql`): doctors can upload
a certificate of registration or good standing (PDF/JPG/PNG, max 5 MB;
required for BHPC). Files are stored in a **private** Storage bucket under the
doctor's own folder. Doctors can only read their own files, admins view them
through 60-second signed URLs, and after approval a doctor can no longer
delete or replace the evidence. Tested with 13 storage-policy checks.
Certificates are personal information, so they need a retention period (see
"Retention & deletion" in §4).

Limits: checking a number against the HPCSA iRegister, or with BHPC (which
has no public online register), is a manual admin step. Existing doctors are
set to "details needed" when the migration runs and must be approved again.

### 5.3 Telehealth was blocked by our own headers ✅ fixed
`vercel.json` now sends `Permissions-Policy: camera=(self), microphone=(self),
geolocation=()`. Tested in Chromium against the built site: with the old
header `getUserMedia` failed with `NotAllowedError`; with the new one it
returns audio and video tracks. Geolocation stays blocked.

Note: the telehealth screens do not capture any media yet (the controls are
UI only). When a video provider is chosen, its origin must be added to the
CSP and, if it runs in an iframe, to the Permissions-Policy, e.g.
`camera=(self "https://video.example.com")`. Patient consent and recording
rules (HPCSA telehealth guidance) need covering too.

---

## 6. Before claiming compliance

Engineering (can be handed to Codex; see `docs/HANDOVER-CODEX.md`):
1. ~~Fix the `super_admin` sign-up hole (§5.1)~~ done in code; apply the migration to production and audit existing roles.
2. ~~Add doctor verification (§5.2)~~ done in code; apply the migration and approve existing doctors.
3. ~~Add an append-only audit log~~ done for views, edits and admin actions
   (`audit_events`); add export events when exports are built.
3a. ~~Staff two-step sign-in~~ done (TOTP, required per practice by default);
   enable TOTP MFA in Supabase Auth settings in production.
4. Build patient data rights flows: export, correction request, deletion
   request.
5. Add a consent and notice step at patient sign-up, linked to a real privacy
   policy.
6. Add retention rules per record type and scheduled deletion.
7. Add dependency scanning and SAST to CI.

Founder / legal:
1. Confirm our role (operator/processor vs responsible party/controller) for
   each kind of data.
2. **Find out where data is hosted** (Supabase project region, Vercel
   functions/logs). Decide on SA and Botswana data residency. Check the
   Botswana "copy must remain in Botswana" rule.
3. Sign data processing agreements with Supabase and Vercel. Create a
   template operator agreement for practices.
4. Appoint and register an Information Officer (SA) and a DPO (Botswana).
5. Fill in the gaps in the draft privacy policy (`src/content/privacyPolicyConfig.ts`) and have it
   reviewed; write the PAIA manual (SA), breach response plan (with
   72-hour DPA and "as soon as reasonably possible" POPIA timelines) and
   processing register.
6. Run a formal risk / data protection impact assessment against the 2026
   POPIA health regulations and the DPA.

---

## 7. Sources

Secondary sources used for this update. Check them against the official
gazettes before relying on specifics.

- Botswana DPA 2024: [Government Gazette, 29 Oct 2024 (Act text)](https://www.dpo-india.com/Resources/privacy_laws_in_africa_nations/Botswana's-Data-Protection-Act,2024.pdf) · [Botswana Laws: Act 18 of 2024](https://testelaws.botswanalaws.com/act-bulletin-2024/act-18-of-2024-data-protection-act/) · [CIPIT: 2018 vs 2024 Acts](https://cipit.strathmore.edu/understanding-botswanas-2018-and-2024-data-protection-acts/) · [Michalsons: Botswana DPA in effect](https://www.michalsons.com/blog/botswanas-data-protection-act-grace-period-extended/60775) · [Bowmans Africa Guide: Data Protection 2025](https://bowmanslaw.com/wp-content/uploads/2025/07/Africa-Guide-Data-Protection-2025_07.pdf) · [Minchin & Kelly](https://www.minchinkelly.bw/2025/08/18/botswana-africa-data-protection-regulatory-frameworks/)
- POPIA health regulations 2026: [Bowmans: regulations cross the finish line](https://bowmanslaw.com/insights/south-africa-popia-health-information-regulations-cross-the-finish-line/) · [Fasken: health data under the microscope](https://www.fasken.com/en/knowledge/2026/04/health-data-under-the-microscope-new-popia-regulations) · [Eversheds Sutherland](https://www.eversheds-sutherland.com/en/south-africa/insights/new-popia-regulations-processing-of-health-information) · [Moonstone: now in force](https://www.moonstone.co.za/new-popia-regulations-on-health-information-now-in-force/)
- POPIA and healthcare generally: [Werksmans: processing healthcare information](https://www.werksmans.com/legal-updates-and-opinions/the-legal-and-ethical-processing-of-healthcare-information/) · [Clyde & Co: POPIA in SA healthcare](https://www.clydeco.com/en/insights/2022/05/cyber-and-popia-in-the-healthcare-industry)

## 8. Verification commands

```bash
npm run lint
npm run build
```
