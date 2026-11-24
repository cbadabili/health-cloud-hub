-- Tenancy foundation (Increment 1 of the practice-management roadmap)
--
-- Turns the single-doctor portal into a multi-practice, staff-run system for
-- Botswana and South Africa:
--   * tenants -> practices -> sites -> rooms; staff memberships with practice
--     roles (owner, manager, receptionist, nurse, clinician, biller) and
--     optional site scope; providers (clinicians who see patients)
--   * patients are practice records (no login needed), with contacts and an
--     optional link to a portal login
--   * appointments, medical_records, prescriptions and invoices now belong to a
--     practice and point at patients/providers, never at login accounts, with
--     ON DELETE RESTRICT so deleting a login can't delete clinical history
--   * access is checked on every query (a deactivated member loses access
--     immediately) and staff need MFA (aal2) unless the practice disables it
--   * append-only audit log of changes to patient, staff, clinical and billing
--     data (ids and changed column names only, never values)
--
-- There is no production data yet: the four clinical/billing tables are
-- emptied and restructured. Platform super_admins no longer get blanket access
-- to clinic data (support access will be time-limited and audited later).
--
-- Requires 20261123200000-doctor-verification.sql (is_verified_doctor).

-- 1. Types ------------------------------------------------------------------------

DO $$ BEGIN CREATE TYPE public.country_code AS ENUM ('BW', 'ZA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.currency_code AS ENUM ('BWP', 'ZAR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.practice_role AS ENUM ('owner', 'manager', 'receptionist', 'nurse', 'clinician', 'biller'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.national_id_type AS ENUM ('omang', 'sa_id', 'passport', 'other', 'none'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.patient_source AS ENUM ('staff', 'portal', 'import'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.patient_status AS ENUM ('active', 'merged'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.portal_link_status AS ENUM ('pending', 'verified'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Organisation ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
  country public.country_code NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
  legal_name TEXT,
  registration_no TEXT,
  country public.country_code NOT NULL,
  currency public.currency_code NOT NULL,
  timezone TEXT NOT NULL,
  require_mfa BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  timezone TEXT NOT NULL,
  phone_e164 TEXT CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  address TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  exclusive BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role public.practice_role NOT NULL,
  all_sites BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (practice_id, user_id, role)
);

CREATE TABLE IF NOT EXISTS public.membership_sites (
  membership_id UUID NOT NULL REFERENCES public.staff_memberships(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  PRIMARY KEY (membership_id, site_id)
);

CREATE TABLE IF NOT EXISTS public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  membership_id UUID NOT NULL UNIQUE REFERENCES public.staff_memberships(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  display_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  email TEXT NOT NULL CHECK (email = lower(btrim(email)) AND email LIKE '%_@_%'),
  role public.practice_role NOT NULL,
  all_sites BOOLEAN NOT NULL DEFAULT true,
  site_ids UUID[] NOT NULL DEFAULT '{}',
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Patients -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  first_name TEXT NOT NULL CHECK (length(btrim(first_name)) BETWEEN 1 AND 80),
  last_name TEXT NOT NULL CHECK (length(btrim(last_name)) BETWEEN 1 AND 80),
  date_of_birth DATE CHECK (date_of_birth IS NULL OR date_of_birth BETWEEN DATE '1900-01-01' AND CURRENT_DATE),
  sex TEXT CHECK (sex IS NULL OR sex IN ('female', 'male', 'other', 'unknown')),
  id_type public.national_id_type NOT NULL DEFAULT 'none',
  id_number TEXT CHECK (id_number IS NULL OR length(btrim(id_number)) BETWEEN 3 AND 30),
  phone_e164 TEXT CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  email TEXT CHECK (email IS NULL OR email LIKE '%_@_%'),
  address TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  source public.patient_source NOT NULL DEFAULT 'staff',
  status public.patient_status NOT NULL DEFAULT 'active',
  merged_into UUID REFERENCES public.patients(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((id_type = 'none') = (id_number IS NULL)),
  CHECK ((status = 'merged') = (merged_into IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_patients_practice_name ON public.patients (practice_id, lower(last_name), lower(first_name));
CREATE INDEX IF NOT EXISTS idx_patients_practice_phone ON public.patients (practice_id, phone_e164);
CREATE INDEX IF NOT EXISTS idx_patients_practice_id_number ON public.patients (practice_id, id_type, id_number);

CREATE TABLE IF NOT EXISTS public.patient_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  relationship TEXT NOT NULL,
  name TEXT NOT NULL,
  phone_e164 TEXT CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  email TEXT,
  is_responsible_party BOOLEAN NOT NULL DEFAULT false,
  is_authorized_rep BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patient_portal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.portal_link_status NOT NULL DEFAULT 'pending',
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, user_id)
);

-- 4. Audit log ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID,
  practice_id UUID,
  actor_user_id UUID,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  outcome TEXT NOT NULL DEFAULT 'success',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_practice_time ON public.audit_events (practice_id, occurred_at DESC);

-- 5. Re-point clinical and billing tables (no production data yet) ---------------

-- Only on the first run (while the old doctor_id column exists): a re-run must never wipe data.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'doctor_id') THEN
    TRUNCATE public.appointments, public.medical_records, public.prescriptions, public.invoices CASCADE;
  END IF;
END $$;

-- Drop every existing policy on these tables; they are recreated below.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('appointments', 'medical_records', 'prescriptions', 'invoices')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;
-- Doctors are no longer linked to patients by login; patient data lives in public.patients.
DROP POLICY IF EXISTS "Doctors can view their patients' profiles" ON public.patient_profiles;

-- Functions from earlier migrations that use the old columns.
DROP FUNCTION IF EXISTS public.book_appointment(UUID, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.doctor_booked_slots(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.cancel_my_appointment(UUID);
DROP FUNCTION IF EXISTS public.list_bookable_doctors();
DROP FUNCTION IF EXISTS public.doctor_patient_profiles(UUID[]);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['appointments', 'medical_records', 'prescriptions', 'invoices'] LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_patient_id_fkey');
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_doctor_id_fkey');
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_provider_id_fkey');
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'doctor_id') THEN
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN doctor_id TO provider_id', t);
    END IF;
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS practice_id UUID NOT NULL REFERENCES public.practices(id) ON DELETE RESTRICT', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.sites(id) ON DELETE RESTRICT', t);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE RESTRICT', t, t || '_patient_id_fkey');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE RESTRICT', t, t || '_provider_id_fkey');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (practice_id)', 'idx_' || t || '_practice', t);
  END LOOP;
END $$;

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.rooms(id) ON DELETE RESTRICT;
ALTER TABLE public.appointments ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS currency public.currency_code;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
DO $$ BEGIN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_practice_number_key UNIQUE (practice_id, invoice_number);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
ALTER INDEX IF EXISTS public.idx_appointments_doctor_id RENAME TO idx_appointments_provider_id;
ALTER INDEX IF EXISTS public.idx_medical_records_doctor_id RENAME TO idx_medical_records_provider_id;

-- 6. Integrity: every reference stays inside one practice ---------------------------

CREATE OR REPLACE FUNCTION public.enforce_same_practice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  row_json JSONB := to_jsonb(NEW);
  ref_practice UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.practice_id IS DISTINCT FROM OLD.practice_id THEN
    RAISE EXCEPTION 'PRACTICE_IS_IMMUTABLE';
  END IF;
  IF row_json ? 'patient_id' AND row_json->>'patient_id' IS NOT NULL THEN
    SELECT practice_id INTO ref_practice FROM public.patients WHERE id = (row_json->>'patient_id')::uuid;
    IF ref_practice IS DISTINCT FROM NEW.practice_id THEN RAISE EXCEPTION 'CROSS_PRACTICE_REFERENCE: patient'; END IF;
  END IF;
  IF row_json ? 'provider_id' AND row_json->>'provider_id' IS NOT NULL THEN
    SELECT practice_id INTO ref_practice FROM public.providers WHERE id = (row_json->>'provider_id')::uuid;
    IF ref_practice IS DISTINCT FROM NEW.practice_id THEN RAISE EXCEPTION 'CROSS_PRACTICE_REFERENCE: provider'; END IF;
  END IF;
  IF row_json ? 'site_id' AND row_json->>'site_id' IS NOT NULL THEN
    SELECT practice_id INTO ref_practice FROM public.sites WHERE id = (row_json->>'site_id')::uuid;
    IF ref_practice IS DISTINCT FROM NEW.practice_id THEN RAISE EXCEPTION 'CROSS_PRACTICE_REFERENCE: site'; END IF;
  END IF;
  IF row_json ? 'room_id' AND row_json->>'room_id' IS NOT NULL THEN
    SELECT practice_id INTO ref_practice FROM public.rooms WHERE id = (row_json->>'room_id')::uuid;
    IF ref_practice IS DISTINCT FROM NEW.practice_id THEN RAISE EXCEPTION 'CROSS_PRACTICE_REFERENCE: room'; END IF;
  END IF;
  IF row_json ? 'membership_id' AND row_json->>'membership_id' IS NOT NULL THEN
    SELECT practice_id INTO ref_practice FROM public.staff_memberships WHERE id = (row_json->>'membership_id')::uuid;
    IF ref_practice IS DISTINCT FROM NEW.practice_id THEN RAISE EXCEPTION 'CROSS_PRACTICE_REFERENCE: membership'; END IF;
  END IF;
  IF row_json ? 'appointment_id' AND row_json->>'appointment_id' IS NOT NULL THEN
    SELECT practice_id INTO ref_practice FROM public.appointments WHERE id = (row_json->>'appointment_id')::uuid;
    IF ref_practice IS DISTINCT FROM NEW.practice_id THEN RAISE EXCEPTION 'CROSS_PRACTICE_REFERENCE: appointment'; END IF;
  END IF;
  IF row_json ? 'medical_record_id' AND row_json->>'medical_record_id' IS NOT NULL THEN
    SELECT practice_id INTO ref_practice FROM public.medical_records WHERE id = (row_json->>'medical_record_id')::uuid;
    IF ref_practice IS DISTINCT FROM NEW.practice_id THEN RAISE EXCEPTION 'CROSS_PRACTICE_REFERENCE: medical record'; END IF;
  END IF;
  IF row_json ? 'merged_into' AND row_json->>'merged_into' IS NOT NULL THEN
    SELECT practice_id INTO ref_practice FROM public.patients WHERE id = (row_json->>'merged_into')::uuid;
    IF ref_practice IS DISTINCT FROM NEW.practice_id THEN RAISE EXCEPTION 'CROSS_PRACTICE_REFERENCE: merged_into'; END IF;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sites', 'rooms', 'staff_memberships', 'membership_sites', 'providers', 'staff_invitations',
                           'patients', 'patient_contacts', 'patient_portal_links',
                           'appointments', 'medical_records', 'prescriptions', 'invoices'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_same_practice ON public.%I', t);
    EXECUTE format('CREATE TRIGGER enforce_same_practice BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_same_practice()', t);
  END LOOP;
END $$;

-- Invoices default to the practice currency.
CREATE OR REPLACE FUNCTION public.default_invoice_currency()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.currency IS NULL THEN
    SELECT currency INTO NEW.currency FROM public.practices WHERE id = NEW.practice_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS default_invoice_currency ON public.invoices;
CREATE TRIGGER default_invoice_currency BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.default_invoice_currency();

-- updated_at for new tables (reuses the existing helper).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants', 'practices', 'sites', 'rooms', 'staff_memberships', 'providers',
                           'staff_invitations', 'patients', 'patient_contacts', 'patient_portal_links'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'update_' || t || '_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', 'update_' || t || '_updated_at', t);
  END LOOP;
END $$;

-- 7. Access helpers -------------------------------------------------------------------

-- Staff need a second factor (aal2) unless the practice has switched MFA off.
CREATE OR REPLACE FUNCTION public.is_staff_mfa_ok(_practice_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(auth.jwt()->>'aal', '') = 'aal2'
      OR coalesce((SELECT NOT require_mfa FROM public.practices WHERE id = _practice_id), false)
$$;

-- Active membership in the practice (optionally with one of the given roles), with MFA satisfied.
CREATE OR REPLACE FUNCTION public.has_practice_role(_practice_id UUID, _roles public.practice_role[] DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_memberships m
    WHERE m.practice_id = _practice_id
      AND m.user_id = auth.uid()
      AND m.active
      AND (_roles IS NULL OR m.role = ANY (_roles))
  ) AND public.is_staff_mfa_ok(_practice_id)
$$;

-- Site scope: a membership with all_sites, or one assigned to this site (optionally limited to roles).
CREATE OR REPLACE FUNCTION public.can_access_site(_site_id UUID, _roles public.practice_role[] DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sites s
    JOIN public.staff_memberships m ON m.practice_id = s.practice_id
    WHERE s.id = _site_id
      AND m.user_id = auth.uid()
      AND m.active
      AND (_roles IS NULL OR m.role = ANY (_roles))
      AND (m.all_sites OR EXISTS (SELECT 1 FROM public.membership_sites ms WHERE ms.membership_id = m.id AND ms.site_id = _site_id))
      AND public.is_staff_mfa_ok(s.practice_id)
  )
$$;

-- Row-level check for practice data that may be tied to a site.
CREATE OR REPLACE FUNCTION public.can_access_row(_practice_id UUID, _site_id UUID, _roles public.practice_role[] DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN _site_id IS NULL THEN public.has_practice_role(_practice_id, _roles)
    ELSE public.can_access_site(_site_id, _roles)
  END
$$;

-- Clinical write access: an active clinician membership, verified registration, MFA.
CREATE OR REPLACE FUNCTION public.is_practice_clinician(_practice_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.has_practice_role(_practice_id, ARRAY['clinician']::public.practice_role[])
     AND public.is_verified_doctor(auth.uid())
$$;

-- The caller's own provider record in a practice.
CREATE OR REPLACE FUNCTION public.my_provider_id(_practice_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id FROM public.providers p
  JOIN public.staff_memberships m ON m.id = p.membership_id
  WHERE p.practice_id = _practice_id AND p.user_id = auth.uid() AND p.active AND m.active
  LIMIT 1
$$;

-- Portal access: a verified link, or a pending link to a record the patient created themselves.
CREATE OR REPLACE FUNCTION public.is_portal_patient(_patient_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patient_portal_links l
    JOIN public.patients p ON p.id = l.patient_id
    WHERE l.patient_id = _patient_id
      AND l.user_id = auth.uid()
      AND p.status = 'active'
      AND (l.status = 'verified' OR (p.source = 'portal' AND p.created_by = auth.uid()))
  )
$$;

-- 8. Audit trail ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.write_audit_event(
  _practice_id UUID, _action TEXT, _target_table TEXT, _target_id UUID, _metadata JSONB DEFAULT '{}'::jsonb, _outcome TEXT DEFAULT 'success')
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_events (tenant_id, practice_id, actor_user_id, action, target_table, target_id, outcome, metadata)
  VALUES ((SELECT tenant_id FROM public.practices WHERE id = _practice_id), _practice_id, auth.uid(),
          _action, _target_table, _target_id, _outcome, coalesce(_metadata, '{}'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.write_audit_event(UUID, TEXT, TEXT, UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;

-- Row changes: ids and changed column names only, never values (no clinical content).
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  rec JSONB := to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END);
  old_rec JSONB := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  changed TEXT[];
  practice UUID;
  target UUID;
BEGIN
  practice := CASE WHEN TG_TABLE_NAME = 'practices' THEN (rec->>'id')::uuid ELSE (rec->>'practice_id')::uuid END;
  target := coalesce((rec->>'id')::uuid, (rec->>'membership_id')::uuid);
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(k ORDER BY k) INTO changed
    FROM jsonb_object_keys(rec) k
    WHERE rec->k IS DISTINCT FROM old_rec->k AND k <> 'updated_at';
    IF changed IS NULL THEN RETURN NULL; END IF;
  END IF;
  PERFORM public.write_audit_event(practice, TG_TABLE_NAME || '.' || lower(TG_OP), TG_TABLE_NAME, target,
    CASE WHEN changed IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('changed', to_jsonb(changed)) END);
  RETURN NULL;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['practices', 'sites', 'rooms', 'staff_memberships', 'membership_sites', 'providers', 'staff_invitations',
                           'patients', 'patient_contacts', 'patient_portal_links',
                           'appointments', 'medical_records', 'prescriptions', 'invoices'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row_change ON public.%I', t);
    EXECUTE format('CREATE TRIGGER audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t);
  END LOOP;
END $$;

-- The log is append-only.
CREATE OR REPLACE FUNCTION public.audit_events_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_EVENTS_ARE_APPEND_ONLY';
END $$;
DROP TRIGGER IF EXISTS audit_events_immutable ON public.audit_events;
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.audit_events_immutable();
DROP TRIGGER IF EXISTS audit_events_no_truncate ON public.audit_events;
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON public.audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_events_immutable();

-- 9. Row-level security -----------------------------------------------------------------

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants', 'practices', 'sites', 'rooms', 'staff_memberships', 'membership_sites', 'providers',
                           'staff_invitations', 'patients', 'patient_contacts', 'patient_portal_links', 'audit_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Organisation. Writes to memberships, invitations and providers go through functions.
DROP POLICY IF EXISTS "Members read their tenant" ON public.tenants;
CREATE POLICY "Members read their tenant" ON public.tenants FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.practices p WHERE p.tenant_id = tenants.id AND public.has_practice_role(p.id)));

DROP POLICY IF EXISTS "Members read their practice" ON public.practices;
CREATE POLICY "Members read their practice" ON public.practices FOR SELECT USING (public.has_practice_role(id));
-- Country, currency, timezone and tenant are fixed after setup.
REVOKE UPDATE ON public.practices FROM PUBLIC, anon, authenticated;
GRANT UPDATE (name, legal_name, registration_no, require_mfa) ON public.practices TO authenticated;
DROP POLICY IF EXISTS "Owners and managers update their practice" ON public.practices;
CREATE POLICY "Owners and managers update their practice" ON public.practices FOR UPDATE
  USING (public.has_practice_role(id, ARRAY['owner', 'manager']::public.practice_role[]));

DROP POLICY IF EXISTS "Members read sites" ON public.sites;
CREATE POLICY "Members read sites" ON public.sites FOR SELECT USING (public.has_practice_role(practice_id));
DROP POLICY IF EXISTS "Owners and managers manage sites" ON public.sites;
CREATE POLICY "Owners and managers manage sites" ON public.sites FOR ALL
  USING (public.has_practice_role(practice_id, ARRAY['owner', 'manager']::public.practice_role[]));

DROP POLICY IF EXISTS "Members read rooms" ON public.rooms;
CREATE POLICY "Members read rooms" ON public.rooms FOR SELECT USING (public.has_practice_role(practice_id));
DROP POLICY IF EXISTS "Owners and managers manage rooms" ON public.rooms;
CREATE POLICY "Owners and managers manage rooms" ON public.rooms FOR ALL
  USING (public.has_practice_role(practice_id, ARRAY['owner', 'manager']::public.practice_role[]));

DROP POLICY IF EXISTS "Users read their own memberships" ON public.staff_memberships;
CREATE POLICY "Users read their own memberships" ON public.staff_memberships FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Owners and managers read practice memberships" ON public.staff_memberships;
CREATE POLICY "Owners and managers read practice memberships" ON public.staff_memberships FOR SELECT
  USING (public.has_practice_role(practice_id, ARRAY['owner', 'manager']::public.practice_role[]));

DROP POLICY IF EXISTS "Members read membership sites" ON public.membership_sites;
CREATE POLICY "Members read membership sites" ON public.membership_sites FOR SELECT
  USING (public.has_practice_role(practice_id, ARRAY['owner', 'manager']::public.practice_role[])
         OR EXISTS (SELECT 1 FROM public.staff_memberships m WHERE m.id = membership_id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "Members read providers" ON public.providers;
CREATE POLICY "Members read providers" ON public.providers FOR SELECT USING (public.has_practice_role(practice_id));

DROP POLICY IF EXISTS "Owners and managers read invitations" ON public.staff_invitations;
CREATE POLICY "Owners and managers read invitations" ON public.staff_invitations FOR SELECT
  USING (public.has_practice_role(practice_id, ARRAY['owner', 'manager']::public.practice_role[]));

-- Patients: all staff roles see demographics; new records go through register_patient (duplicate check).
DROP POLICY IF EXISTS "Staff read patients" ON public.patients;
CREATE POLICY "Staff read patients" ON public.patients FOR SELECT USING (public.has_practice_role(practice_id));
DROP POLICY IF EXISTS "Staff update patients" ON public.patients;
CREATE POLICY "Staff update patients" ON public.patients FOR UPDATE
  USING (public.has_practice_role(practice_id, ARRAY['owner', 'manager', 'receptionist', 'nurse', 'clinician']::public.practice_role[]));
-- Staff may edit demographics only; status, merge, source and practice change through functions.
REVOKE UPDATE ON public.patients FROM PUBLIC, anon, authenticated;
GRANT UPDATE (first_name, last_name, date_of_birth, sex, id_type, id_number, phone_e164, email, address, preferred_language)
  ON public.patients TO authenticated;
DROP POLICY IF EXISTS "Portal users read their own patient record" ON public.patients;
CREATE POLICY "Portal users read their own patient record" ON public.patients FOR SELECT USING (public.is_portal_patient(id));

DROP POLICY IF EXISTS "Staff read patient contacts" ON public.patient_contacts;
CREATE POLICY "Staff read patient contacts" ON public.patient_contacts FOR SELECT USING (public.has_practice_role(practice_id));
DROP POLICY IF EXISTS "Staff manage patient contacts" ON public.patient_contacts;
CREATE POLICY "Staff manage patient contacts" ON public.patient_contacts FOR ALL
  USING (public.has_practice_role(practice_id, ARRAY['owner', 'manager', 'receptionist', 'nurse', 'clinician']::public.practice_role[]));
DROP POLICY IF EXISTS "Portal users read their own contacts" ON public.patient_contacts;
CREATE POLICY "Portal users read their own contacts" ON public.patient_contacts FOR SELECT USING (public.is_portal_patient(patient_id));

DROP POLICY IF EXISTS "Front desk reads portal links" ON public.patient_portal_links;
CREATE POLICY "Front desk reads portal links" ON public.patient_portal_links FOR SELECT
  USING (public.has_practice_role(practice_id, ARRAY['owner', 'manager', 'receptionist']::public.practice_role[]));
DROP POLICY IF EXISTS "Portal users read their own links" ON public.patient_portal_links;
CREATE POLICY "Portal users read their own links" ON public.patient_portal_links FOR SELECT USING (user_id = auth.uid());

-- Appointments: staff by site scope; portal patients their own. New bookings go through functions.
CREATE POLICY "Staff read appointments" ON public.appointments FOR SELECT
  USING (public.can_access_row(practice_id, site_id));
CREATE POLICY "Front desk and clinicians update appointments" ON public.appointments FOR UPDATE
  USING (public.can_access_row(practice_id, site_id, ARRAY['owner', 'manager', 'receptionist', 'nurse', 'clinician']::public.practice_role[]));
CREATE POLICY "Portal users read their own appointments" ON public.appointments FOR SELECT
  USING (public.is_portal_patient(patient_id));

-- Clinical records: clinicians and nurses read; verified clinicians write their own.
CREATE POLICY "Clinical staff read medical records" ON public.medical_records FOR SELECT
  USING (public.can_access_row(practice_id, site_id, ARRAY['clinician', 'nurse']::public.practice_role[]));
CREATE POLICY "Clinicians write their own medical records" ON public.medical_records FOR INSERT
  WITH CHECK (public.is_practice_clinician(practice_id)
              AND public.can_access_row(practice_id, site_id, ARRAY['clinician']::public.practice_role[])
              AND provider_id = public.my_provider_id(practice_id));
CREATE POLICY "Clinicians update their own medical records" ON public.medical_records FOR UPDATE
  USING (public.is_practice_clinician(practice_id) AND provider_id = public.my_provider_id(practice_id))
  WITH CHECK (provider_id = public.my_provider_id(practice_id));
CREATE POLICY "Portal users read their own medical records" ON public.medical_records FOR SELECT
  USING (public.is_portal_patient(patient_id));

CREATE POLICY "Clinical staff read prescriptions" ON public.prescriptions FOR SELECT
  USING (public.can_access_row(practice_id, site_id, ARRAY['clinician', 'nurse']::public.practice_role[]));
CREATE POLICY "Clinicians write their own prescriptions" ON public.prescriptions FOR INSERT
  WITH CHECK (public.is_practice_clinician(practice_id)
              AND public.can_access_row(practice_id, site_id, ARRAY['clinician']::public.practice_role[])
              AND provider_id = public.my_provider_id(practice_id));
CREATE POLICY "Clinicians update their own prescriptions" ON public.prescriptions FOR UPDATE
  USING (public.is_practice_clinician(practice_id) AND provider_id = public.my_provider_id(practice_id))
  WITH CHECK (provider_id = public.my_provider_id(practice_id));
CREATE POLICY "Portal users read their own prescriptions" ON public.prescriptions FOR SELECT
  USING (public.is_portal_patient(patient_id));

-- Invoices: billing, front desk (to collect) and management.
CREATE POLICY "Billing staff read invoices" ON public.invoices FOR SELECT
  USING (public.can_access_row(practice_id, site_id, ARRAY['owner', 'manager', 'biller', 'receptionist']::public.practice_role[]));
CREATE POLICY "Billing staff write invoices" ON public.invoices FOR INSERT
  WITH CHECK (public.can_access_row(practice_id, site_id, ARRAY['owner', 'manager', 'biller']::public.practice_role[]));
CREATE POLICY "Billing staff update invoices" ON public.invoices FOR UPDATE
  USING (public.can_access_row(practice_id, site_id, ARRAY['owner', 'manager', 'biller']::public.practice_role[]));
CREATE POLICY "Portal users read their own invoices" ON public.invoices FOR SELECT
  USING (public.is_portal_patient(patient_id));

DROP POLICY IF EXISTS "Owners and managers read the audit log" ON public.audit_events;
CREATE POLICY "Owners and managers read the audit log" ON public.audit_events FOR SELECT
  USING (public.has_practice_role(practice_id, ARRAY['owner', 'manager']::public.practice_role[]));

-- 10. Practice and staff functions ---------------------------------------------------------

-- Practices the caller belongs to. Works before MFA, so the app can show the MFA step.
CREATE OR REPLACE FUNCTION public.my_practices()
RETURNS TABLE (practice_id UUID, name TEXT, country public.country_code, currency public.currency_code,
               timezone TEXT, require_mfa BOOLEAN, roles public.practice_role[], all_sites BOOLEAN, provider_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, p.name, p.country, p.currency, p.timezone, p.require_mfa,
         array_agg(m.role ORDER BY m.role), bool_or(m.all_sites),
         (SELECT pr.id FROM public.providers pr WHERE pr.practice_id = p.id AND pr.user_id = auth.uid() AND pr.active LIMIT 1)
  FROM public.staff_memberships m
  JOIN public.practices p ON p.id = m.practice_id
  WHERE m.user_id = auth.uid() AND m.active
  GROUP BY p.id
  ORDER BY p.name
$$;

-- Staff list for owners and managers (profiles are private, so names come from here).
CREATE OR REPLACE FUNCTION public.practice_staff_directory(_practice_id UUID)
RETURNS TABLE (membership_id UUID, user_id UUID, role public.practice_role, active BOOLEAN, all_sites BOOLEAN,
               site_ids UUID[], first_name TEXT, last_name TEXT, email TEXT, provider_id UUID, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.id, m.user_id, m.role, m.active, m.all_sites,
         coalesce((SELECT array_agg(ms.site_id) FROM public.membership_sites ms WHERE ms.membership_id = m.id), '{}'),
         pf.first_name, pf.last_name, pf.email,
         (SELECT pr.id FROM public.providers pr WHERE pr.membership_id = m.id),
         m.created_at
  FROM public.staff_memberships m
  LEFT JOIN public.profiles pf ON pf.user_id = m.user_id
  WHERE m.practice_id = _practice_id
    AND public.has_practice_role(_practice_id, ARRAY['owner', 'manager']::public.practice_role[])
  ORDER BY m.active DESC, pf.last_name NULLS LAST, pf.first_name NULLS LAST, m.role
$$;

CREATE OR REPLACE FUNCTION public.create_practice(_name TEXT, _country public.country_code, _site_name TEXT DEFAULT 'Main site')
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller UUID := auth.uid();
  tz TEXT := CASE _country WHEN 'BW' THEN 'Africa/Gaborone' ELSE 'Africa/Johannesburg' END;
  cur public.currency_code := CASE _country WHEN 'BW' THEN 'BWP'::public.currency_code ELSE 'ZAR'::public.currency_code END;
  new_tenant UUID;
  new_practice UUID;
  owner_membership UUID;
  clinician_membership UUID;
  display TEXT;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF _name IS NULL OR length(btrim(_name)) < 2 THEN RAISE EXCEPTION 'INVALID_NAME'; END IF;

  INSERT INTO public.tenants (name, country) VALUES (btrim(_name), _country) RETURNING id INTO new_tenant;
  INSERT INTO public.practices (tenant_id, name, country, currency, timezone, created_by)
    VALUES (new_tenant, btrim(_name), _country, cur, tz, caller) RETURNING id INTO new_practice;
  INSERT INTO public.sites (practice_id, name, timezone)
    VALUES (new_practice, coalesce(nullif(btrim(_site_name), ''), 'Main site'), tz);
  INSERT INTO public.staff_memberships (practice_id, user_id, role, created_by)
    VALUES (new_practice, caller, 'owner', caller) RETURNING id INTO owner_membership;

  -- A practitioner account that creates a practice also sees patients there.
  IF public.has_role(caller, 'doctor') THEN
    INSERT INTO public.staff_memberships (practice_id, user_id, role, created_by)
      VALUES (new_practice, caller, 'clinician', caller) RETURNING id INTO clinician_membership;
    SELECT coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), email) INTO display
      FROM public.profiles WHERE user_id = caller;
    INSERT INTO public.providers (practice_id, membership_id, user_id, display_name)
      VALUES (new_practice, clinician_membership, caller, coalesce(display, 'Clinician'));
  END IF;

  RETURN new_practice;
END $$;

-- Returns a one-time token for the invitation link. Only its hash is stored.
CREATE OR REPLACE FUNCTION public.invite_staff(_practice_id UUID, _email TEXT, _role public.practice_role,
                                               _all_sites BOOLEAN DEFAULT true, _site_ids UUID[] DEFAULT '{}')
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  token TEXT := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  clean_email TEXT := lower(btrim(coalesce(_email, '')));
BEGIN
  IF NOT public.has_practice_role(_practice_id, ARRAY['owner', 'manager']::public.practice_role[]) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF _role = 'owner' AND NOT public.has_practice_role(_practice_id, ARRAY['owner']::public.practice_role[]) THEN
    RAISE EXCEPTION 'ONLY_OWNERS_CAN_INVITE_OWNERS';
  END IF;
  IF clean_email NOT LIKE '%_@_%' THEN RAISE EXCEPTION 'INVALID_EMAIL'; END IF;
  IF NOT coalesce(_all_sites, true) AND (
       cardinality(coalesce(_site_ids, '{}')) = 0
       OR EXISTS (SELECT 1 FROM unnest(_site_ids) s(id) WHERE NOT EXISTS (
            SELECT 1 FROM public.sites WHERE sites.id = s.id AND practice_id = _practice_id))) THEN
    RAISE EXCEPTION 'INVALID_SITES';
  END IF;

  -- One open invitation per email and role.
  UPDATE public.staff_invitations SET revoked_at = now()
  WHERE practice_id = _practice_id AND email = clean_email AND role = _role AND accepted_at IS NULL AND revoked_at IS NULL;

  INSERT INTO public.staff_invitations (practice_id, email, role, all_sites, site_ids, token_hash, expires_at, invited_by)
  VALUES (_practice_id, clean_email, _role, coalesce(_all_sites, true),
          CASE WHEN coalesce(_all_sites, true) THEN '{}' ELSE _site_ids END,
          encode(sha256(convert_to(token, 'UTF8')), 'hex'), now() + interval '7 days', auth.uid());
  RETURN token;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_invitation(_invitation_id UUID)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE practice UUID;
BEGIN
  SELECT practice_id INTO practice FROM public.staff_invitations WHERE id = _invitation_id;
  IF practice IS NULL OR NOT public.has_practice_role(practice, ARRAY['owner', 'manager']::public.practice_role[]) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  UPDATE public.staff_invitations SET revoked_at = now() WHERE id = _invitation_id AND accepted_at IS NULL;
END $$;

-- What an invitation link is for, so the page can explain it before sign-in.
-- Only someone holding the (secret) token can call this usefully.
CREATE OR REPLACE FUNCTION public.invitation_preview(_token TEXT)
RETURNS TABLE (practice_name TEXT, country public.country_code, role public.practice_role, email TEXT, status TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.name, p.country, i.role, i.email,
         CASE WHEN i.revoked_at IS NOT NULL THEN 'revoked'
              WHEN i.accepted_at IS NOT NULL THEN 'used'
              WHEN i.expires_at <= now() THEN 'expired'
              ELSE 'open' END
  FROM public.staff_invitations i
  JOIN public.practices p ON p.id = i.practice_id
  WHERE i.token_hash = encode(sha256(convert_to(coalesce(_token, ''), 'UTF8')), 'hex')
$$;

-- The signed-in user's email must match the invitation.
CREATE OR REPLACE FUNCTION public.accept_invitation(_token TEXT)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller UUID := auth.uid();
  caller_email TEXT := lower(coalesce(auth.jwt()->>'email', ''));
  inv public.staff_invitations;
  membership UUID;
  display TEXT;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  SELECT * INTO inv FROM public.staff_invitations
  WHERE token_hash = encode(sha256(convert_to(coalesce(_token, ''), 'UTF8')), 'hex')
  FOR UPDATE;
  IF inv.id IS NULL OR inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'INVITATION_ALREADY_USED'; END IF;
  IF inv.expires_at <= now() THEN RAISE EXCEPTION 'INVITATION_EXPIRED'; END IF;
  IF inv.email <> caller_email THEN RAISE EXCEPTION 'INVITATION_EMAIL_MISMATCH'; END IF;

  INSERT INTO public.staff_memberships (practice_id, user_id, role, all_sites, created_by)
  VALUES (inv.practice_id, caller, inv.role, inv.all_sites, inv.invited_by)
  ON CONFLICT (practice_id, user_id, role) DO UPDATE
    SET active = true, all_sites = EXCLUDED.all_sites, deactivated_at = NULL, deactivated_by = NULL
  RETURNING id INTO membership;

  DELETE FROM public.membership_sites WHERE membership_id = membership;
  INSERT INTO public.membership_sites (membership_id, site_id, practice_id)
  SELECT membership, s, inv.practice_id FROM unnest(inv.site_ids) s;

  IF inv.role = 'clinician' THEN
    SELECT coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), email) INTO display
      FROM public.profiles WHERE user_id = caller;
    INSERT INTO public.providers (practice_id, membership_id, user_id, display_name)
    VALUES (inv.practice_id, membership, caller, coalesce(display, 'Clinician'))
    ON CONFLICT (membership_id) DO UPDATE SET active = true;
  END IF;

  UPDATE public.staff_invitations SET accepted_at = now(), accepted_by = caller WHERE id = inv.id;
  RETURN inv.practice_id;
END $$;

-- Owners/managers deactivate staff. Managers can't touch owners; the last owner stays.
CREATE OR REPLACE FUNCTION public.deactivate_staff(_membership_id UUID)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.staff_memberships;
BEGIN
  SELECT * INTO m FROM public.staff_memberships WHERE id = _membership_id FOR UPDATE;
  IF m.id IS NULL OR NOT public.has_practice_role(m.practice_id, ARRAY['owner', 'manager']::public.practice_role[]) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF m.role = 'owner' THEN
    IF NOT public.has_practice_role(m.practice_id, ARRAY['owner']::public.practice_role[]) THEN
      RAISE EXCEPTION 'ONLY_OWNERS_CAN_REMOVE_OWNERS';
    END IF;
    IF (SELECT count(*) FROM public.staff_memberships
        WHERE practice_id = m.practice_id AND role = 'owner' AND active AND id <> m.id) = 0 THEN
      RAISE EXCEPTION 'LAST_OWNER';
    END IF;
  END IF;
  UPDATE public.staff_memberships SET active = false, deactivated_at = now(), deactivated_by = auth.uid() WHERE id = m.id;
  UPDATE public.providers SET active = false WHERE membership_id = m.id;
END $$;

CREATE OR REPLACE FUNCTION public.set_staff_sites(_membership_id UUID, _all_sites BOOLEAN, _site_ids UUID[] DEFAULT '{}')
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.staff_memberships;
BEGIN
  SELECT * INTO m FROM public.staff_memberships WHERE id = _membership_id FOR UPDATE;
  IF m.id IS NULL OR NOT public.has_practice_role(m.practice_id, ARRAY['owner', 'manager']::public.practice_role[]) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF NOT _all_sites AND (cardinality(coalesce(_site_ids, '{}')) = 0
       OR EXISTS (SELECT 1 FROM unnest(_site_ids) s(id) WHERE NOT EXISTS (
            SELECT 1 FROM public.sites WHERE sites.id = s.id AND practice_id = m.practice_id))) THEN
    RAISE EXCEPTION 'INVALID_SITES';
  END IF;
  UPDATE public.staff_memberships SET all_sites = _all_sites WHERE id = m.id;
  DELETE FROM public.membership_sites WHERE membership_id = m.id;
  IF NOT _all_sites THEN
    INSERT INTO public.membership_sites (membership_id, site_id, practice_id)
    SELECT m.id, s, m.practice_id FROM unnest(_site_ids) s;
  END IF;
END $$;

-- 11. Patient functions --------------------------------------------------------------

-- Possible duplicates: same ID number, same phone, or same date of birth and surname.
CREATE OR REPLACE FUNCTION public.find_patient_duplicates(
  _practice_id UUID, _first_name TEXT, _last_name TEXT, _date_of_birth DATE,
  _id_type public.national_id_type, _id_number TEXT, _phone_e164 TEXT, _exclude UUID DEFAULT NULL)
RETURNS TABLE (patient_id UUID, first_name TEXT, last_name TEXT, date_of_birth DATE, phone_e164 TEXT, reason TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, p.first_name, p.last_name, p.date_of_birth, p.phone_e164,
         CASE
           WHEN _id_number IS NOT NULL AND p.id_type = _id_type AND upper(p.id_number) = upper(btrim(_id_number)) THEN 'same_id_number'
           WHEN _phone_e164 IS NOT NULL AND p.phone_e164 = _phone_e164 THEN 'same_phone'
           ELSE 'same_birth_date_and_surname'
         END
  FROM public.patients p
  WHERE p.practice_id = _practice_id
    AND p.status = 'active'
    AND (_exclude IS NULL OR p.id <> _exclude)
    AND public.has_practice_role(_practice_id)
    AND (
      (_id_number IS NOT NULL AND p.id_type = _id_type AND upper(p.id_number) = upper(btrim(_id_number)))
      OR (_phone_e164 IS NOT NULL AND p.phone_e164 = _phone_e164)
      OR (_date_of_birth IS NOT NULL AND p.date_of_birth = _date_of_birth AND lower(p.last_name) = lower(btrim(_last_name)))
    )
  LIMIT 10
$$;

-- Registers a patient. If possible duplicates exist and _confirm_new is false, nothing
-- is created and the duplicates are returned for staff to review.
CREATE OR REPLACE FUNCTION public.register_patient(
  _practice_id UUID, _first_name TEXT, _last_name TEXT,
  _date_of_birth DATE DEFAULT NULL, _sex TEXT DEFAULT NULL,
  _id_type public.national_id_type DEFAULT 'none', _id_number TEXT DEFAULT NULL,
  _phone_e164 TEXT DEFAULT NULL, _email TEXT DEFAULT NULL, _address TEXT DEFAULT NULL,
  _confirm_new BOOLEAN DEFAULT false)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  dupes JSONB;
  new_id UUID;
  clean_id TEXT := nullif(btrim(coalesce(_id_number, '')), '');
  clean_type public.national_id_type := CASE
    WHEN nullif(btrim(coalesce(_id_number, '')), '') IS NULL THEN 'none'
    WHEN _id_type IS NULL OR _id_type = 'none' THEN 'other'
    ELSE _id_type END;
BEGIN
  IF NOT public.has_practice_role(_practice_id, ARRAY['owner', 'manager', 'receptionist', 'nurse', 'clinician']::public.practice_role[]) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) INTO dupes
  FROM public.find_patient_duplicates(_practice_id, _first_name, _last_name, _date_of_birth,
                                      clean_type, clean_id, nullif(btrim(coalesce(_phone_e164, '')), '')) d;

  IF jsonb_array_length(dupes) > 0 AND NOT coalesce(_confirm_new, false) THEN
    RETURN jsonb_build_object('patient_id', NULL, 'duplicates', dupes);
  END IF;

  INSERT INTO public.patients (practice_id, first_name, last_name, date_of_birth, sex, id_type, id_number,
                               phone_e164, email, address, source, created_by)
  VALUES (_practice_id, btrim(_first_name), btrim(_last_name), _date_of_birth, nullif(_sex, ''), clean_type, clean_id,
          nullif(btrim(coalesce(_phone_e164, '')), ''), nullif(lower(btrim(coalesce(_email, ''))), ''),
          nullif(btrim(coalesce(_address, '')), ''), 'staff', auth.uid())
  RETURNING id INTO new_id;

  IF jsonb_array_length(dupes) > 0 THEN
    PERFORM public.write_audit_event(_practice_id, 'patients.registered_despite_duplicates', 'patients', new_id,
      jsonb_build_object('possible_duplicates', (SELECT jsonb_agg(d->'patient_id') FROM jsonb_array_elements(dupes) d)));
  END IF;

  RETURN jsonb_build_object('patient_id', new_id, 'duplicates', dupes);
END $$;

-- Merge a duplicate into the record to keep. Everything linked moves; nothing is deleted.
CREATE OR REPLACE FUNCTION public.merge_patients(_keep_id UUID, _merge_id UUID, _reason TEXT)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE keep_p public.patients; merge_p public.patients;
BEGIN
  SELECT * INTO keep_p FROM public.patients WHERE id = _keep_id FOR UPDATE;
  SELECT * INTO merge_p FROM public.patients WHERE id = _merge_id FOR UPDATE;
  IF keep_p.id IS NULL OR merge_p.id IS NULL OR keep_p.id = merge_p.id THEN RAISE EXCEPTION 'INVALID_PATIENTS'; END IF;
  IF keep_p.practice_id <> merge_p.practice_id THEN RAISE EXCEPTION 'CROSS_PRACTICE_REFERENCE: patient'; END IF;
  IF NOT public.has_practice_role(keep_p.practice_id, ARRAY['owner', 'manager']::public.practice_role[]) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  IF keep_p.status <> 'active' OR merge_p.status <> 'active' THEN RAISE EXCEPTION 'ALREADY_MERGED'; END IF;
  IF length(btrim(coalesce(_reason, ''))) < 3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;

  UPDATE public.appointments SET patient_id = _keep_id WHERE patient_id = _merge_id;
  UPDATE public.medical_records SET patient_id = _keep_id WHERE patient_id = _merge_id;
  UPDATE public.prescriptions SET patient_id = _keep_id WHERE patient_id = _merge_id;
  UPDATE public.invoices SET patient_id = _keep_id WHERE patient_id = _merge_id;
  UPDATE public.patient_contacts SET patient_id = _keep_id WHERE patient_id = _merge_id;

  -- Portal links move but must be verified again (the kept record has more data).
  DELETE FROM public.patient_portal_links l
  WHERE l.patient_id = _merge_id
    AND EXISTS (SELECT 1 FROM public.patient_portal_links k WHERE k.patient_id = _keep_id AND k.user_id = l.user_id);
  UPDATE public.patient_portal_links SET patient_id = _keep_id, status = 'pending', verified_by = NULL, verified_at = NULL
  WHERE patient_id = _merge_id;

  -- Keep identifiers the surviving record lacks.
  UPDATE public.patients SET
    date_of_birth = coalesce(date_of_birth, merge_p.date_of_birth),
    phone_e164 = coalesce(phone_e164, merge_p.phone_e164),
    email = coalesce(email, merge_p.email),
    id_type = CASE WHEN id_type = 'none' THEN merge_p.id_type ELSE id_type END,
    id_number = CASE WHEN id_type = 'none' THEN merge_p.id_number ELSE id_number END
  WHERE id = _keep_id;

  UPDATE public.patients SET status = 'merged', merged_into = _keep_id WHERE id = _merge_id;
  PERFORM public.write_audit_event(keep_p.practice_id, 'patients.merge', 'patients', _keep_id,
    jsonb_build_object('merged_patient_id', _merge_id, 'reason', btrim(_reason)));
END $$;

CREATE OR REPLACE FUNCTION public.verify_portal_link(_link_id UUID)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE practice UUID;
BEGIN
  SELECT practice_id INTO practice FROM public.patient_portal_links WHERE id = _link_id;
  IF practice IS NULL OR NOT public.has_practice_role(practice, ARRAY['owner', 'manager', 'receptionist']::public.practice_role[]) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;
  UPDATE public.patient_portal_links SET status = 'verified', verified_by = auth.uid(), verified_at = now() WHERE id = _link_id;
END $$;

-- Reads can't fire triggers, so the app records chart opens explicitly.
CREATE OR REPLACE FUNCTION public.log_patient_view(_patient_id UUID)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE practice UUID;
BEGIN
  SELECT practice_id INTO practice FROM public.patients WHERE id = _patient_id;
  IF practice IS NULL OR NOT public.has_practice_role(practice) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  PERFORM public.write_audit_event(practice, 'patients.view', 'patients', _patient_id);
END $$;

-- 12. Portal booking (re-pointed to practices and providers) ----------------------------

CREATE OR REPLACE FUNCTION public.list_bookable_providers()
RETURNS TABLE (provider_id UUID, practice_id UUID, practice_name TEXT, country public.country_code,
               currency public.currency_code, timezone TEXT, display_name TEXT,
               specialization TEXT, consultation_fee NUMERIC, telehealth_enabled BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pr.id, p.id, p.name, p.country, p.currency, p.timezone, pr.display_name,
         dp.specialization, dp.consultation_fee, dp.telehealth_enabled
  FROM public.providers pr
  JOIN public.practices p ON p.id = pr.practice_id
  JOIN public.staff_memberships m ON m.id = pr.membership_id AND m.active
  LEFT JOIN public.doctor_profiles dp ON dp.user_id = pr.user_id
  WHERE pr.active
    AND public.is_verified_doctor(pr.user_id)
    AND auth.uid() IS NOT NULL
  ORDER BY p.name, pr.display_name
$$;

CREATE OR REPLACE FUNCTION public.provider_booked_slots(_provider_id UUID, _from TIMESTAMPTZ, _to TIMESTAMPTZ)
RETURNS SETOF TIMESTAMPTZ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF _to <= _from OR _to - _from > interval '7 days' THEN RAISE EXCEPTION 'INVALID_RANGE'; END IF;
  RETURN QUERY
    SELECT a.appointment_date FROM public.appointments a
    WHERE a.provider_id = _provider_id AND a.status = 'scheduled'
      AND a.appointment_date >= _from AND a.appointment_date < _to;
END $$;

-- A portal patient books an in-person visit. Their first booking at a practice creates
-- a portal patient record with a pending link for reception to verify or merge.
CREATE OR REPLACE FUNCTION public.book_appointment(_provider_id UUID, _starts_at TIMESTAMPTZ, _reason TEXT)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller UUID := auth.uid();
  reason TEXT := btrim(coalesce(_reason, ''));
  prov public.providers;
  patient UUID;
  site UUID;
  prof public.profiles;
  new_id UUID;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF NOT public.has_role(caller, 'patient') THEN RAISE EXCEPTION 'ONLY_PATIENTS_CAN_BOOK'; END IF;
  SELECT * INTO prov FROM public.providers WHERE id = _provider_id;
  IF prov.id IS NULL OR NOT prov.active OR NOT public.is_verified_doctor(prov.user_id)
     OR NOT EXISTS (SELECT 1 FROM public.staff_memberships WHERE id = prov.membership_id AND active) THEN
    RAISE EXCEPTION 'DOCTOR_NOT_AVAILABLE';
  END IF;
  IF _starts_at IS NULL OR _starts_at <= now() THEN RAISE EXCEPTION 'TIME_IN_PAST'; END IF;
  IF _starts_at > now() + interval '1 year' THEN RAISE EXCEPTION 'TOO_FAR_AHEAD'; END IF;
  IF length(reason) < 3 OR length(reason) > 1000 THEN RAISE EXCEPTION 'INVALID_REASON'; END IF;

  SELECT id INTO site FROM public.sites WHERE practice_id = prov.practice_id AND active ORDER BY created_at LIMIT 1;
  IF site IS NULL THEN RAISE EXCEPTION 'DOCTOR_NOT_AVAILABLE'; END IF;

  -- Find this user's patient record at the practice, or create a portal one.
  SELECT l.patient_id INTO patient
  FROM public.patient_portal_links l JOIN public.patients p ON p.id = l.patient_id
  WHERE l.user_id = caller AND l.practice_id = prov.practice_id AND p.status = 'active'
  ORDER BY (l.status = 'verified') DESC, l.created_at
  LIMIT 1;
  IF patient IS NULL THEN
    SELECT * INTO prof FROM public.profiles WHERE user_id = caller;
    INSERT INTO public.patients (practice_id, first_name, last_name, email, source, created_by)
    VALUES (prov.practice_id, coalesce(nullif(btrim(prof.first_name), ''), 'Unknown'),
            coalesce(nullif(btrim(prof.last_name), ''), 'Unknown'), nullif(lower(prof.email), ''), 'portal', caller)
    RETURNING id INTO patient;
    INSERT INTO public.patient_portal_links (practice_id, patient_id, user_id, status)
    VALUES (prov.practice_id, patient, caller, 'pending');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_provider_id::text || '|' || _starts_at::text, 0));
  IF EXISTS (SELECT 1 FROM public.appointments
             WHERE provider_id = _provider_id AND appointment_date = _starts_at AND status = 'scheduled') THEN
    RAISE EXCEPTION 'SLOT_TAKEN';
  END IF;

  INSERT INTO public.appointments (practice_id, site_id, patient_id, provider_id, appointment_date,
                                   appointment_type, status, reason_for_visit)
  VALUES (prov.practice_id, site, patient, _provider_id, _starts_at, 'in_person', 'scheduled', reason)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_my_appointment(_appointment_id UUID)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  UPDATE public.appointments a
  SET status = 'cancelled', updated_at = now()
  WHERE a.id = _appointment_id
    AND public.is_portal_patient(a.patient_id)
    AND a.status = 'scheduled'
    AND a.appointment_date > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_CANCELLABLE'; END IF;
END $$;

-- 13. Function privileges: signed-in users only ------------------------------------------

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.my_practices()', 'public.practice_staff_directory(uuid)', 'public.create_practice(text, public.country_code, text)',
    'public.invite_staff(uuid, text, public.practice_role, boolean, uuid[])', 'public.revoke_invitation(uuid)',
    'public.accept_invitation(text)', 'public.deactivate_staff(uuid)', 'public.set_staff_sites(uuid, boolean, uuid[])',
    'public.find_patient_duplicates(uuid, text, text, date, public.national_id_type, text, text, uuid)',
    'public.register_patient(uuid, text, text, date, text, public.national_id_type, text, text, text, text, boolean)',
    'public.merge_patients(uuid, uuid, text)', 'public.verify_portal_link(uuid)', 'public.log_patient_view(uuid)',
    'public.list_bookable_providers()', 'public.provider_booked_slots(uuid, timestamptz, timestamptz)',
    'public.book_appointment(uuid, timestamptz, text)', 'public.cancel_my_appointment(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.invitation_preview(text) TO anon, authenticated;

-- Access-check helpers are used inside RLS policies, so every API role must be able to
-- evaluate them. They only read and return false for anonymous callers.
GRANT EXECUTE ON FUNCTION public.is_staff_mfa_ok(uuid), public.has_practice_role(uuid, public.practice_role[]),
  public.can_access_site(uuid, public.practice_role[]), public.can_access_row(uuid, uuid, public.practice_role[]),
  public.is_practice_clinician(uuid), public.my_provider_id(uuid), public.is_portal_patient(uuid)
  TO anon, authenticated;

-- Trigger-only functions are never called directly.
REVOKE ALL ON FUNCTION public.enforce_same_practice() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.default_invoice_currency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;
