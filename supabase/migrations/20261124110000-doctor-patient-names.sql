-- Let verified doctors see the names and emails of their own patients
--
-- public.profiles only lets users read their own row (plus super_admins), so
-- every doctor screen that looked up patient names got nothing back. Rather
-- than open the profiles table (which also holds phone, address and photo),
-- this function returns ONLY first name, last name and email, and ONLY for
-- patients who have a care relationship with the calling doctor (an
-- appointment, medical record, prescription or invoice with them), and only
-- if the doctor is verified.
--
-- Requires 20261123200000-doctor-verification.sql (is_verified_doctor).

CREATE OR REPLACE FUNCTION public.doctor_patient_profiles(_patient_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller UUID := auth.uid();
BEGIN
  IF caller IS NULL OR NOT public.has_role(caller, 'doctor') OR NOT public.is_verified_doctor(caller) THEN
    RETURN;  -- not a verified doctor: nothing to see
  END IF;
  IF _patient_ids IS NULL OR cardinality(_patient_ids) = 0 THEN
    RETURN;
  END IF;
  IF cardinality(_patient_ids) > 1000 THEN
    RAISE EXCEPTION 'TOO_MANY_IDS';
  END IF;

  RETURN QUERY
    SELECT p.user_id, p.first_name, p.last_name, p.email
    FROM public.profiles p
    WHERE p.user_id = ANY (_patient_ids)
      AND (
        EXISTS (SELECT 1 FROM public.appointments a WHERE a.patient_id = p.user_id AND a.doctor_id = caller)
        OR EXISTS (SELECT 1 FROM public.medical_records m WHERE m.patient_id = p.user_id AND m.doctor_id = caller)
        OR EXISTS (SELECT 1 FROM public.prescriptions r WHERE r.patient_id = p.user_id AND r.doctor_id = caller)
        OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.patient_id = p.user_id AND i.doctor_id = caller)
      );
END;
$$;

REVOKE ALL ON FUNCTION public.doctor_patient_profiles(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.doctor_patient_profiles(UUID[]) TO authenticated;
