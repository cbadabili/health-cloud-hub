-- 20261124090000-patient-booking.sql: server-validated patient booking.
-- The concurrent double-booking race is in concurrency/booking_race.sh.

SELECT tests.create_user('doc@x', '{"role":"doctor","first_name":"Naledi","last_name":"Molefe","registration_council":"HPCSA","registration_number":"MP1"}') AS doc \gset
SELECT tests.create_user('unverified@x', '{"role":"doctor"}') AS unverified \gset
SELECT tests.create_user('pat1@x', '{"role":"patient"}') AS pat1 \gset
SELECT tests.create_user('pat2@x', '{"role":"patient"}') AS pat2 \gset
UPDATE public.doctor_verifications SET status = 'approved' WHERE doctor_id = :'doc';
INSERT INTO public.doctor_profiles (user_id, specialization, consultation_fee) VALUES (:'doc', 'General Practice', 450), (:'unverified', 'Cardiology', 650);
SELECT (date_trunc('hour', now()) + interval '2 days 9 hours') AS slot \gset

SELECT tests.anon();
SELECT tests.throws($$ SELECT * FROM public.list_bookable_doctors() $$, 'permission denied', 'anonymous visitors cannot list doctors');
SELECT tests.throws(format($f$ SELECT public.book_appointment(%L, %L, 'Checkup') $f$, :'doc', :'slot'), 'permission denied', 'anonymous visitors cannot book');

SELECT tests.login(:'pat1');
SELECT tests.is((SELECT count(*)::int FROM public.list_bookable_doctors()), 1, 'patients see only verified doctors');
SELECT tests.ok((SELECT first_name = 'Naledi' AND consultation_fee = 450 FROM public.list_bookable_doctors()), 'doctor list has name and fee');
SELECT tests.ok(public.book_appointment(:'doc', :'slot', '  Follow-up on blood pressure  ') IS NOT NULL, 'a patient can book a verified doctor');
SELECT tests.ok((SELECT appointment_type = 'in_person' AND status = 'scheduled' AND reason_for_visit = 'Follow-up on blood pressure'
  FROM public.appointments), 'booking is saved in person, scheduled, with the reason trimmed');
SELECT tests.throws(format($f$ SELECT public.book_appointment(%L, %L, 'Checkup') $f$, :'unverified', :'slot'), 'DOCTOR_NOT_AVAILABLE', 'cannot book an unverified doctor');
SELECT tests.throws(format($f$ SELECT public.book_appointment(%L, now() - interval '1 hour', 'Checkup') $f$, :'doc'), 'TIME_IN_PAST', 'cannot book in the past');
SELECT tests.throws(format($f$ SELECT public.book_appointment(%L, now() + interval '400 days', 'Checkup') $f$, :'doc'), 'TOO_FAR_AHEAD', 'cannot book more than a year ahead');
SELECT tests.throws(format($f$ SELECT public.book_appointment(%L, %L::timestamptz + interval '1 hour', '  ') $f$, :'doc', :'slot'), 'INVALID_REASON', 'a reason is required');
SELECT tests.is((SELECT count(*)::int FROM public.doctor_booked_slots(:'doc', :'slot'::timestamptz - interval '12 hours', :'slot'::timestamptz + interval '12 hours')), 1, 'booked slots show the taken time');
SELECT tests.throws(format($f$ SELECT * FROM public.doctor_booked_slots(%L, now(), now() + interval '8 days') $f$, :'doc'), 'INVALID_RANGE', 'slot lookups are limited to 7 days');

SELECT tests.login(:'pat2');
SELECT tests.throws(format($f$ SELECT public.book_appointment(%L, %L, 'Checkup') $f$, :'doc', :'slot'), 'SLOT_TAKEN', 'a second patient cannot take the same slot');
SELECT tests.is((SELECT count(*)::int FROM public.appointments), 0, 'patients cannot see each other''s appointments');
SELECT tests.throws(format($f$ SELECT public.cancel_my_appointment(%L) $f$, (SELECT id FROM public.appointments LIMIT 0)), 'NOT_CANCELLABLE', 'cannot cancel an appointment you can''t see');

SELECT tests.login(:'doc');
SELECT tests.is((SELECT count(*)::int FROM public.appointments), 1, 'the doctor sees the booking');
SELECT tests.throws(format($f$ SELECT public.book_appointment(%L, %L::timestamptz + interval '2 hours', 'Self') $f$, :'doc', :'slot'), 'ONLY_PATIENTS_CAN_BOOK', 'doctors cannot book as patients');
SELECT id AS appt FROM public.appointments LIMIT 1 \gset

SELECT tests.login(:'pat2');
SELECT tests.throws(format($f$ SELECT public.cancel_my_appointment(%L) $f$, :'appt'), 'NOT_CANCELLABLE', 'a patient cannot cancel someone else''s appointment');

SELECT tests.login(:'pat1');
SELECT public.cancel_my_appointment(:'appt');
SELECT tests.is((SELECT status FROM public.appointments WHERE id = :'appt'), 'cancelled', 'a patient can cancel their own appointment');
SELECT tests.throws(format($f$ SELECT public.cancel_my_appointment(%L) $f$, :'appt'), 'NOT_CANCELLABLE', 'it cannot be cancelled twice');
WITH u AS (UPDATE public.appointments SET status = 'scheduled' RETURNING 1)
SELECT tests.is((SELECT count(*)::int FROM u), 0, 'patients cannot change appointment status directly');

SELECT tests.login(:'pat2');
SELECT tests.ok(public.book_appointment(:'doc', :'slot', 'Checkup') IS NOT NULL, 'a cancelled slot can be booked again');
