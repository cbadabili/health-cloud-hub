-- Doctor verification: registration certificate upload
--
-- Doctors can upload a certificate of registration / good standing (PDF, JPG
-- or PNG, max 5 MB) for admins to check. Files live in a PRIVATE storage
-- bucket; each doctor can only touch files under "<their user id>/", and
-- admins read them through short-lived signed URLs.
--
-- Requires 20261123200000-doctor-verification.sql.

-- 1. Column on doctor_verifications ---------------------------------------------

ALTER TABLE public.doctor_verifications
  ADD COLUMN IF NOT EXISTS certificate_path TEXT;

-- 2. Private bucket (size and type limits enforced by Storage) -------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'doctor-certificates',
  'doctor-certificates',
  false,
  5242880, -- 5 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Storage policies ---------------------------------------------------------------

DROP POLICY IF EXISTS "Doctors can upload their own certificates" ON storage.objects;
CREATE POLICY "Doctors can upload their own certificates"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'doctor-certificates'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_role(auth.uid(), 'doctor')
  );

DROP POLICY IF EXISTS "Doctors can view their own certificates" ON storage.objects;
CREATE POLICY "Doctors can view their own certificates"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'doctor-certificates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Doctors may remove their own files only while not approved, so the evidence
-- an admin relied on can't be deleted afterwards.
DROP POLICY IF EXISTS "Doctors can delete their own unapproved certificates" ON storage.objects;
CREATE POLICY "Doctors can delete their own unapproved certificates"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'doctor-certificates'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND NOT public.is_verified_doctor(auth.uid())
  );

DROP POLICY IF EXISTS "Super admins can view all certificates" ON storage.objects;
CREATE POLICY "Super admins can view all certificates"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'doctor-certificates' AND public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins can delete certificates" ON storage.objects;
CREATE POLICY "Super admins can delete certificates"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'doctor-certificates' AND public.has_role(auth.uid(), 'super_admin'));

-- 4. Let doctors add a certificate while their review is pending ------------------
-- (Previously only not_submitted/rejected rows were editable.) Any doctor edit
-- still resets the row to 'pending' via the guard trigger.

DROP POLICY IF EXISTS "Doctors can resubmit their own verification" ON public.doctor_verifications;
CREATE POLICY "Doctors can resubmit their own verification"
  ON public.doctor_verifications FOR UPDATE
  USING (auth.uid() = doctor_id AND status IN ('not_submitted', 'pending', 'rejected'))
  WITH CHECK (auth.uid() = doctor_id);

-- 5. Guard trigger: also validate certificate_path -------------------------------

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

  -- A certificate must live in the doctor's own folder of the private bucket.
  IF NEW.certificate_path IS NOT NULL
     AND NEW.certificate_path NOT LIKE NEW.doctor_id::text || '/%' THEN
    RAISE EXCEPTION 'certificate_path must be inside the doctor''s own folder';
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
