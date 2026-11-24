-- 20261124110000-doctor-patient-names.sql: doctors see names/emails of their own patients only.

SELECT tests.create_user('doc@x', '{"role":"doctor","registration_council":"HPCSA","registration_number":"MP1"}') AS doc \gset
SELECT tests.create_user('unverified@x', '{"role":"doctor"}') AS unverified \gset
SELECT tests.create_user('appt@x', '{"role":"patient","first_name":"Ayanda","last_name":"Appt"}') AS p_appt \gset
SELECT tests.create_user('record@x', '{"role":"patient","first_name":"Rami","last_name":"Record"}') AS p_record \gset
SELECT tests.create_user('rx@x', '{"role":"patient","first_name":"Pula","last_name":"Prescription"}') AS p_rx \gset
SELECT tests.create_user('stranger@x', '{"role":"patient","first_name":"Sam","last_name":"Stranger"}') AS p_stranger \gset
UPDATE public.doctor_verifications SET status = 'approved' WHERE doctor_id = :'doc';
INSERT INTO public.appointments (patient_id, doctor_id, appointment_date, appointment_type) VALUES
  (:'p_appt', :'doc', now() + interval '1 day', 'in_person'),
  (:'p_stranger', :'unverified', now() + interval '1 day', 'in_person');
INSERT INTO public.medical_records (patient_id, doctor_id, diagnosis) VALUES (:'p_record', :'doc', 'Flu');
INSERT INTO public.prescriptions (patient_id, doctor_id, medication_name, dosage, frequency, duration)
  VALUES (:'p_rx', :'doc', 'Amoxicillin', '500mg', '3x daily', '7 days');
SELECT ARRAY[:'p_appt', :'p_record', :'p_rx', :'p_stranger']::uuid[] AS everyone \gset

SELECT tests.anon();
SELECT tests.throws(format($f$ SELECT * FROM public.doctor_patient_profiles(%L) $f$, :'everyone'), 'permission denied', 'anonymous visitors are refused');

SELECT tests.login(:'doc');
SELECT tests.is((SELECT string_agg(last_name, ',' ORDER BY last_name) FROM public.doctor_patient_profiles(:'everyone')),
  'Appt,Prescription,Record', 'a verified doctor gets patients they have an appointment, record or prescription with, not a stranger');
SELECT tests.is((SELECT pg_get_function_result('public.doctor_patient_profiles(uuid[])'::regprocedure)),
  'TABLE(user_id uuid, first_name text, last_name text, email text)', 'only id, name and email are returned (no phone or address)');
SELECT tests.is((SELECT count(*)::int FROM public.profiles WHERE user_id <> auth.uid()), 0, 'direct profile reads are still blocked');
SELECT tests.throws($$ SELECT * FROM public.doctor_patient_profiles(ARRAY(SELECT gen_random_uuid() FROM generate_series(1, 1001))) $$,
  'TOO_MANY_IDS', 'more than 1000 ids are refused');
SELECT tests.is((SELECT count(*)::int FROM public.doctor_patient_profiles(ARRAY[]::uuid[])), 0, 'empty input returns nothing');
SELECT tests.is((SELECT count(*)::int FROM public.doctor_patient_profiles(NULL)), 0, 'null input returns nothing');

SELECT tests.login(:'unverified');
SELECT tests.is((SELECT count(*)::int FROM public.doctor_patient_profiles(:'everyone')), 0, 'an unverified doctor gets nothing, even with an appointment');

SELECT tests.login(:'p_appt');
SELECT tests.is((SELECT count(*)::int FROM public.doctor_patient_profiles(:'everyone')), 0, 'a patient gets nothing');

SELECT tests.logout();
UPDATE public.doctor_verifications SET status = 'rejected' WHERE doctor_id = :'doc';
SELECT tests.login(:'doc');
SELECT tests.is((SELECT count(*)::int FROM public.doctor_patient_profiles(:'everyone')), 0, 'revoking verification removes access');
