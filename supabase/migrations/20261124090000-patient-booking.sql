-- Patient appointment booking
--
-- Real booking for the patient portal (previously the screen showed a success
-- message without saving anything). Patients can't read other users' profiles,
-- so booking goes through narrowly scoped SECURITY DEFINER functions that
-- validate everything server-side.
--
-- Requires 20261123200000-doctor-verification.sql (is_verified_doctor,
-- doctor_verifications).

-- 1. Verified doctors a signed-in user can book with (no emails or contact details).
CREATE OR REPLACE FUNCTION public.list_bookable_doctors()
RETURNS TABLE (
  doctor_id UUID,
  first_name TEXT,
  last_name TEXT,
  specialization TEXT,
  consultation_fee NUMERIC,
  telehealth_enabled BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT v.doctor_id, p.first_name, p.last_name, dp.specialization, dp.consultation_fee, dp.telehealth_enabled
  FROM public.doctor_verifications v
  JOIN public.profiles p ON p.user_id = v.doctor_id
  LEFT JOIN public.doctor_profiles dp ON dp.user_id = v.doctor_id
  WHERE v.status = 'approved'
    AND auth.uid() IS NOT NULL
  ORDER BY p.last_name NULLS LAST, p.first_name NULLS LAST;
$$;

-- 2. Start times already taken for a doctor in a window (max 7 days).
--    Reveals only that a slot is busy, never who booked it.
CREATE OR REPLACE FUNCTION public.doctor_booked_slots(_doctor_id UUID, _from TIMESTAMPTZ, _to TIMESTAMPTZ)
RETURNS SETOF TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_SIGNED_IN';
  END IF;
  IF _to <= _from OR _to - _from > interval '7 days' THEN
    RAISE EXCEPTION 'INVALID_RANGE';
  END IF;
  RETURN QUERY
    SELECT a.appointment_date
    FROM public.appointments a
    WHERE a.doctor_id = _doctor_id
      AND a.status = 'scheduled'
      AND a.appointment_date >= _from
      AND a.appointment_date < _to;
END;
$$;

-- 3. Book an in-person appointment. Returns the new appointment id.
--    Error messages are stable codes the app maps to friendly text.
CREATE OR REPLACE FUNCTION public.book_appointment(_doctor_id UUID, _starts_at TIMESTAMPTZ, _reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller UUID := auth.uid();
  reason TEXT := btrim(coalesce(_reason, ''));
  new_id UUID;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'NOT_SIGNED_IN';
  END IF;
  IF NOT public.has_role(caller, 'patient') THEN
    RAISE EXCEPTION 'ONLY_PATIENTS_CAN_BOOK';
  END IF;
  IF NOT public.is_verified_doctor(_doctor_id) THEN
    RAISE EXCEPTION 'DOCTOR_NOT_AVAILABLE';
  END IF;
  IF _starts_at IS NULL OR _starts_at <= now() THEN
    RAISE EXCEPTION 'TIME_IN_PAST';
  END IF;
  IF _starts_at > now() + interval '1 year' THEN
    RAISE EXCEPTION 'TOO_FAR_AHEAD';
  END IF;
  IF length(reason) < 3 OR length(reason) > 1000 THEN
    RAISE EXCEPTION 'INVALID_REASON';
  END IF;

  -- Serialise bookings for the same doctor and time so two patients can't both get it.
  PERFORM pg_advisory_xact_lock(hashtextextended(_doctor_id::text || '|' || _starts_at::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE doctor_id = _doctor_id AND appointment_date = _starts_at AND status = 'scheduled'
  ) THEN
    RAISE EXCEPTION 'SLOT_TAKEN';
  END IF;

  INSERT INTO public.appointments (patient_id, doctor_id, appointment_date, appointment_type, status, reason_for_visit)
  VALUES (caller, _doctor_id, _starts_at, 'in_person', 'scheduled', reason)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- 4. Cancel one of your own upcoming appointments.
CREATE OR REPLACE FUNCTION public.cancel_my_appointment(_appointment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_SIGNED_IN';
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled', updated_at = now()
  WHERE id = _appointment_id
    AND patient_id = auth.uid()
    AND status = 'scheduled'
    AND appointment_date > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_CANCELLABLE';
  END IF;
END;
$$;

-- 5. Only signed-in users may call these (they also check auth.uid() themselves).
REVOKE ALL ON FUNCTION public.list_bookable_doctors() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.doctor_booked_slots(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.book_appointment(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_my_appointment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_bookable_doctors() TO authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_booked_slots(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_appointment(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_my_appointment(UUID) TO authenticated;
