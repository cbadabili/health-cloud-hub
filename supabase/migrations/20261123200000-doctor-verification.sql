-- Doctor verification
--
-- Until now anyone could sign up as a doctor and immediately receive the
-- doctor RLS policies. This migration:
--   1. Adds public.doctor_verifications (registration council + number + status).
--   2. Makes every doctor policy that touches patient data require an
--      APPROVED verification (enforced in the database, not just the UI).
--   3. Lets patients see only verified doctors.
--   4. Captures registration details at sign-up (status 'pending').
--   5. Backfills existing doctors as 'not_submitted' so they must submit details
--      and be approved. Approve known doctors in bulk if needed:
--        UPDATE public.doctor_verifications SET status = 'approved'
--        WHERE doctor_id IN ('<uuid>', ...);
--
-- Only super_admins (or SQL run directly by the database owner, e.g. the
-- Supabase SQL editor) can set status to 'approved' or 'rejected'.

-- 1. Types and table -----------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('not_submitted', 'pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.registration_council AS ENUM ('HPCSA', 'BHPC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.doctor_verifications (
  doctor_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  council public.registration_council,
  registration_number TEXT CHECK (registration_number IS NULL OR length(btrim(registration_number)) BETWEEN 3 AND 40),
  status public.verification_status NOT NULL DEFAULT 'not_submitted',
  rejection_reason TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctor_verifications_status ON public.doctor_verifications(status);

ALTER TABLE public.doctor_verifications ENABLE ROW LEVEL SECURITY;

-- 2. Helper -------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_verified_doctor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.doctor_verifications
    WHERE doctor_id = _user_id AND status = 'approved'
  );
$$;

-- 3. Guard: doctors can submit details but never set their own status ----------

CREATE OR REPLACE FUNCTION public.guard_doctor_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller UUID := auth.uid();
BEGIN
  NEW.updated_at := now();

  IF NEW.registration_number IS NOT NULL THEN
    NEW.registration_number := nullif(btrim(NEW.registration_number), '');
  END IF;

  -- Trusted callers: super_admins, and direct database access with no end-user
  -- JWT (sign-up trigger, Supabase SQL editor, service jobs). Anonymous API
  -- requests also have no uid, but RLS gives them no access to this table.
  IF caller IS NULL OR public.has_role(caller, 'super_admin') THEN
    IF caller IS NOT NULL
       AND NEW.status IN ('approved', 'rejected')
       AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
      NEW.reviewed_at := now();
      NEW.reviewed_by := caller;
    END IF;
    IF NEW.status = 'approved' THEN
      NEW.rejection_reason := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Everyone else (a doctor editing their own row): status is derived, review
  -- fields are cleared, so submitting details always goes back for review.
  IF NEW.council IS NOT NULL AND NEW.registration_number IS NOT NULL THEN
    NEW.status := 'pending';
    NEW.submitted_at := now();
  ELSE
    NEW.status := 'not_submitted';
    NEW.submitted_at := NULL;
  END IF;
  NEW.reviewed_at := NULL;
  NEW.reviewed_by := NULL;
  IF TG_OP = 'UPDATE' THEN
    NEW.doctor_id := OLD.doctor_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_doctor_verification ON public.doctor_verifications;
CREATE TRIGGER guard_doctor_verification
  BEFORE INSERT OR UPDATE ON public.doctor_verifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_doctor_verification();

-- 4. RLS for doctor_verifications ----------------------------------------------

DROP POLICY IF EXISTS "Doctors can view their own verification" ON public.doctor_verifications;
CREATE POLICY "Doctors can view their own verification"
  ON public.doctor_verifications FOR SELECT
  USING (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Doctors can submit their own verification" ON public.doctor_verifications;
CREATE POLICY "Doctors can submit their own verification"
  ON public.doctor_verifications FOR INSERT
  WITH CHECK (auth.uid() = doctor_id AND public.has_role(auth.uid(), 'doctor'));

-- Doctors may only edit while not yet submitted or after a rejection.
DROP POLICY IF EXISTS "Doctors can resubmit their own verification" ON public.doctor_verifications;
CREATE POLICY "Doctors can resubmit their own verification"
  ON public.doctor_verifications FOR UPDATE
  USING (auth.uid() = doctor_id AND status IN ('not_submitted', 'rejected'))
  WITH CHECK (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Super admins can manage all verifications" ON public.doctor_verifications;
CREATE POLICY "Super admins can manage all verifications"
  ON public.doctor_verifications FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 5. Require an approved verification on every doctor policy ------------------

DROP POLICY IF EXISTS "Doctors can view their patients' profiles" ON public.patient_profiles;
CREATE POLICY "Doctors can view their patients' profiles"
  ON public.patient_profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'doctor') AND
    public.is_verified_doctor(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.appointments
      WHERE doctor_id = auth.uid() AND patient_id = user_id
    )
  );

DROP POLICY IF EXISTS "Doctors can view their appointments" ON public.appointments;
CREATE POLICY "Doctors can view their appointments"
  ON public.appointments FOR SELECT
  USING (auth.uid() = doctor_id AND public.is_verified_doctor(auth.uid()));

DROP POLICY IF EXISTS "Doctors can update their appointments" ON public.appointments;
CREATE POLICY "Doctors can update their appointments"
  ON public.appointments FOR UPDATE
  USING (auth.uid() = doctor_id AND public.is_verified_doctor(auth.uid()));

-- Patients may only book with verified doctors.
DROP POLICY IF EXISTS "Patients can create appointments" ON public.appointments;
CREATE POLICY "Patients can create appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = patient_id AND public.is_verified_doctor(doctor_id));

DROP POLICY IF EXISTS "Doctors can manage medical records for their patients" ON public.medical_records;
CREATE POLICY "Doctors can manage medical records for their patients"
  ON public.medical_records FOR ALL
  USING (auth.uid() = doctor_id AND public.is_verified_doctor(auth.uid()));

DROP POLICY IF EXISTS "Doctors can manage prescriptions for their patients" ON public.prescriptions;
CREATE POLICY "Doctors can manage prescriptions for their patients"
  ON public.prescriptions FOR ALL
  USING (auth.uid() = doctor_id AND public.is_verified_doctor(auth.uid()));

DROP POLICY IF EXISTS "Doctors can view invoices for their patients" ON public.invoices;
CREATE POLICY "Doctors can view invoices for their patients"
  ON public.invoices FOR SELECT
  USING (auth.uid() = doctor_id AND public.is_verified_doctor(auth.uid()));

DROP POLICY IF EXISTS "Doctors can create invoices for their patients" ON public.invoices;
CREATE POLICY "Doctors can create invoices for their patients"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = doctor_id AND public.is_verified_doctor(auth.uid()));

-- Patients only see verified doctors.
DROP POLICY IF EXISTS "Patients can view doctor profiles" ON public.doctor_profiles;
CREATE POLICY "Patients can view doctor profiles"
  ON public.doctor_profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'patient') AND public.is_verified_doctor(user_id));

-- 6. Sign-up: capture registration details for doctors -------------------------
-- Keeps the role allow-list from 20261123180000-restrict-signup-roles.sql.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role text := lower(coalesce(NEW.raw_user_meta_data->>'role', ''));
  requested_council text := upper(btrim(coalesce(NEW.raw_user_meta_data->>'registration_council', '')));
  requested_number text := left(nullif(btrim(coalesce(NEW.raw_user_meta_data->>'registration_number', '')), ''), 40);
  assigned_role public.app_role;
  council public.registration_council;
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );

  -- Allow-list of self-selectable roles. Never trust client metadata for anything else.
  IF requested_role = 'doctor' THEN
    assigned_role := 'doctor'::public.app_role;
  ELSE
    assigned_role := 'patient'::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);

  IF assigned_role = 'doctor' THEN
    IF requested_council IN ('HPCSA', 'BHPC') THEN
      council := requested_council::public.registration_council;
    END IF;
    IF requested_number IS NOT NULL AND length(requested_number) < 3 THEN
      requested_number := NULL;
    END IF;

    -- Status is always set here, never taken from metadata.
    INSERT INTO public.doctor_verifications (doctor_id, council, registration_number, status, submitted_at)
    VALUES (
      NEW.id,
      council,
      requested_number,
      CASE WHEN council IS NOT NULL AND requested_number IS NOT NULL
           THEN 'pending'::public.verification_status
           ELSE 'not_submitted'::public.verification_status END,
      CASE WHEN council IS NOT NULL AND requested_number IS NOT NULL THEN now() END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 7. Backfill existing doctors ---------------------------------------------------

INSERT INTO public.doctor_verifications (doctor_id, status)
SELECT r.user_id, 'not_submitted'::public.verification_status
FROM public.user_roles r
WHERE r.role = 'doctor'
ON CONFLICT (doctor_id) DO NOTHING;
