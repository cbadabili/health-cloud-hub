-- Portal booking (20261124090000, re-pointed to practices/providers in 20261125090000).
-- The concurrent double-booking race is in concurrency/booking_race.sh.

SELECT tests.create_user('doc@x', '{"role":"doctor","first_name":"Naledi","last_name":"Molefe","registration_council":"BHPC","registration_number":"BHPC-1"}') AS doc \gset
SELECT tests.create_user('unverified@x', '{"role":"doctor","first_name":"Fake","last_name":"Doc"}') AS unverified \gset
SELECT tests.create_user('desk@x') AS desk \gset
SELECT tests.create_user('pat1@x', '{"role":"patient","first_name":"Ayanda","last_name":"Dube"}') AS pat1 \gset
SELECT tests.create_user('pat2@x', '{"role":"patient"}') AS pat2 \gset
UPDATE public.doctor_verifications SET status = 'approved' WHERE doctor_id = :'doc';
INSERT INTO public.doctor_profiles (user_id, specialization, consultation_fee) VALUES (:'doc', 'General Practice', 450);

SELECT tests.login(:'doc', 'aal2');
SELECT public.create_practice('Gaborone Family Clinic', 'BW', 'Main') AS practice \gset
SELECT tests.logout();
SELECT id AS provider FROM public.providers WHERE user_id = :'doc' \gset
SELECT tests.add_staff(:'practice', :'unverified', 'clinician') \gset
SELECT id AS unverified_provider FROM public.providers WHERE user_id = :'unverified' \gset
SELECT tests.add_staff(:'practice', :'desk', 'receptionist') \gset
SELECT (date_trunc('hour', now()) + interval '2 days 9 hours') AS slot \gset

SELECT tests.anon();
SELECT tests.throws($$ SELECT * FROM public.list_bookable_providers() $$, 'permission denied', 'anonymous visitors cannot list providers');
SELECT tests.throws(format($f$ SELECT public.book_appointment(%L, %L, 'Checkup') $f$, :'provider', :'slot'), 'permission denied', 'anonymous visitors cannot book');

SELECT tests.login(:'pat1');
SELECT tests.is((SELECT count(*)::int FROM public.list_bookable_providers()), 1, 'patients see only verified providers');
SELECT tests.ok((SELECT practice_name = 'Gaborone Family Clinic' AND currency = 'BWP' AND timezone = 'Africa/Gaborone' AND consultation_fee = 450
  FROM public.list_bookable_providers()), 'provider list has practice, currency, timezone and fee');
SELECT tests.ok(public.book_appointment(:'provider', :'slot', '  Follow-up on blood pressure  ') IS NOT NULL, 'a patient can book a verified provider');
SELECT tests.ok((SELECT appointment_type = 'in_person' AND status = 'scheduled' AND reason_for_visit = 'Follow-up on blood pressure'
  FROM public.appointments), 'booking is saved in person, scheduled, with the reason trimmed');
SELECT tests.ok((SELECT source = 'portal' AND first_name = 'Ayanda' AND last_name = 'Dube' FROM public.patients),
  'the first booking creates a portal patient record from the profile');
SELECT tests.is((SELECT status::text FROM public.patient_portal_links), 'pending', 'its portal link is pending until reception verifies it');
SELECT tests.ok(public.book_appointment(:'provider', :'slot'::timestamptz + interval '1 day', 'Second visit') IS NOT NULL, 'a second booking works');
SELECT tests.is((SELECT count(DISTINCT patient_id)::int FROM public.appointments), 1, 'the second booking reuses the same patient record');
SELECT tests.throws(format($f$ SELECT public.book_appointment(%L, %L, 'Checkup') $f$, :'unverified_provider', :'slot'), 'DOCTOR_NOT_AVAILABLE', 'cannot book an unverified provider');
SELECT tests.throws(format($f$ SELECT public.book_appointment(%L, now() - interval '1 hour', 'Checkup') $f$, :'provider'), 'TIME_IN_PAST', 'cannot book in the past');
SELECT tests.throws(format($f$ SELECT public.book_appointment(%L, now() + interval '400 days', 'Checkup') $f$, :'provider'), 'TOO_FAR_AHEAD', 'cannot book more than a year ahead');
SELECT tests.throws(format($f$ SELECT public.book_appointment(%L, %L::timestamptz + interval '1 hour', '  ') $f$, :'provider', :'slot'), 'INVALID_REASON', 'a reason is required');
SELECT tests.is((SELECT count(*)::int FROM public.provider_booked_slots(:'provider', :'slot'::timestamptz - interval '12 hours', :'slot'::timestamptz + interval '12 hours')), 1, 'booked slots show the taken time');
SELECT tests.throws(format($f$ SELECT * FROM public.provider_booked_slots(%L, now(), now() + interval '8 days') $f$, :'provider'), 'INVALID_RANGE', 'slot lookups are limited to 7 days');

SELECT tests.login(:'pat2');
SELECT tests.throws(format($f$ SELECT public.book_appointment(%L, %L, 'Checkup') $f$, :'provider', :'slot'), 'SLOT_TAKEN', 'a second patient cannot take the same slot');
SELECT tests.is((SELECT count(*)::int FROM public.appointments), 0, 'patients cannot see each other''s appointments');
SELECT tests.is((SELECT count(*)::int FROM public.patients), 0, 'patients cannot see each other''s records');

SELECT tests.login(:'desk', 'aal2');
SELECT tests.is((SELECT count(*)::int FROM public.appointments), 2, 'reception sees portal bookings at their practice');
SELECT tests.is((SELECT count(*)::int FROM public.patient_portal_links WHERE status = 'pending'), 1, 'reception sees the pending portal link');

SELECT tests.login(:'doc', 'aal2');
SELECT tests.throws(format($f$ SELECT public.book_appointment(%L, %L::timestamptz + interval '2 hours', 'Self') $f$, :'provider', :'slot'), 'ONLY_PATIENTS_CAN_BOOK', 'staff accounts cannot book through the portal');
SELECT id AS appt FROM public.appointments WHERE appointment_date = :'slot' \gset

SELECT tests.login(:'pat2');
SELECT tests.throws(format($f$ SELECT public.cancel_my_appointment(%L) $f$, :'appt'), 'NOT_CANCELLABLE', 'a patient cannot cancel someone else''s appointment');

SELECT tests.login(:'pat1');
SELECT public.cancel_my_appointment(:'appt');
SELECT tests.is((SELECT status FROM public.appointments WHERE id = :'appt'), 'cancelled', 'a patient can cancel their own appointment');
SELECT tests.throws(format($f$ SELECT public.cancel_my_appointment(%L) $f$, :'appt'), 'NOT_CANCELLABLE', 'it cannot be cancelled twice');
WITH u AS (UPDATE public.appointments SET status = 'scheduled' RETURNING 1)
SELECT tests.is((SELECT count(*)::int FROM u), 0, 'patients cannot change appointment status directly');

SELECT tests.login(:'pat2');
SELECT tests.ok(public.book_appointment(:'provider', :'slot', 'Checkup') IS NOT NULL, 'a cancelled slot can be booked again');
