-- 20261123200000-doctor-verification.sql (+ policy change in 20261123210000):
-- doctors get no patient data until a super_admin approves their registration.

SELECT tests.create_user('admin@x') AS admin \gset
UPDATE public.user_roles SET role = 'super_admin' WHERE user_id = :'admin';
SELECT tests.create_user('doc@x', '{"role":"doctor","registration_council":"hpcsa","registration_number":" MP0123456 "}') AS doc \gset
SELECT tests.create_user('fake@x', '{"role":"doctor"}') AS fake \gset
SELECT tests.create_user('bw@x', '{"role":"doctor","registration_council":"BHPC","registration_number":"x"}') AS bw \gset
SELECT tests.create_user('pat@x', '{"role":"patient"}') AS pat \gset

SELECT tests.is((SELECT status::text FROM public.doctor_verifications WHERE doctor_id = :'doc'), 'pending', 'council + number at sign-up gives pending (never approved)');
SELECT tests.is((SELECT registration_number FROM public.doctor_verifications WHERE doctor_id = :'doc'), 'MP0123456', 'registration number is trimmed');
SELECT tests.is((SELECT council::text FROM public.doctor_verifications WHERE doctor_id = :'doc'), 'HPCSA', 'council is normalised');
SELECT tests.is((SELECT status::text FROM public.doctor_verifications WHERE doctor_id = :'fake'), 'not_submitted', 'no details gives not_submitted');
SELECT tests.is((SELECT status::text FROM public.doctor_verifications WHERE doctor_id = :'bw'), 'not_submitted', 'a too-short number is rejected at sign-up');

INSERT INTO public.doctor_profiles (user_id, specialization) VALUES (:'doc', 'GP'), (:'fake', 'GP');
INSERT INTO public.patient_profiles (user_id) VALUES (:'pat');
INSERT INTO public.appointments (patient_id, doctor_id, appointment_date, appointment_type)
  VALUES (:'pat', :'doc', now() + interval '1 day', 'in_person'), (:'pat', :'fake', now() + interval '1 day', 'in_person');
INSERT INTO public.medical_records (patient_id, doctor_id, diagnosis) VALUES (:'pat', :'doc', 'Hypertension'), (:'pat', :'fake', 'Flu');

-- Unverified doctor
SELECT tests.login(:'fake');
SELECT tests.is((SELECT count(*)::int FROM public.appointments), 0, 'unverified doctor sees no appointments');
SELECT tests.is((SELECT count(*)::int FROM public.medical_records), 0, 'unverified doctor sees no medical records');
SELECT tests.is((SELECT count(*)::int FROM public.patient_profiles), 0, 'unverified doctor sees no patient profiles');
SELECT tests.throws(format($f$ INSERT INTO public.medical_records (patient_id, doctor_id, diagnosis)
  VALUES (%L, auth.uid(), 'x') $f$, :'pat'), 'row-level security', 'unverified doctor cannot write medical records');
UPDATE public.doctor_verifications SET council = 'HPCSA', registration_number = 'MP999', status = 'approved', reviewed_by = auth.uid() WHERE doctor_id = auth.uid();
SELECT tests.is((SELECT status::text FROM public.doctor_verifications), 'pending', 'trying to self-approve leaves the row pending');
SELECT tests.ok((SELECT reviewed_by IS NULL FROM public.doctor_verifications), 'review fields are cleared on a doctor edit');
SELECT tests.is((SELECT count(*)::int FROM public.doctor_verifications), 1, 'a doctor sees only their own verification');

-- Patient
SELECT tests.login(:'pat');
SELECT tests.is((SELECT count(*)::int FROM public.doctor_profiles), 0, 'patients see no unverified doctors');
SELECT tests.is((SELECT count(*)::int FROM public.doctor_verifications), 0, 'patients cannot see verifications');

-- Admin decides
SELECT tests.login(:'admin');
UPDATE public.doctor_verifications SET status = 'approved' WHERE doctor_id = :'doc';
UPDATE public.doctor_verifications SET status = 'rejected', rejection_reason = 'Number not on register' WHERE doctor_id = :'fake';
SELECT tests.ok((SELECT reviewed_by = :'admin' AND reviewed_at IS NOT NULL FROM public.doctor_verifications WHERE doctor_id = :'doc'), 'approval is stamped with the admin and time');

-- Approved doctor
SELECT tests.login(:'doc');
SELECT tests.is((SELECT count(*)::int FROM public.appointments), 1, 'approved doctor sees their own appointment');
SELECT tests.is((SELECT count(*)::int FROM public.medical_records), 1, 'approved doctor sees their own record');
SELECT tests.is((SELECT count(*)::int FROM public.patient_profiles), 1, 'approved doctor sees their patient''s profile');
WITH u AS (UPDATE public.doctor_verifications SET registration_number = 'CHANGED' WHERE doctor_id = auth.uid() RETURNING 1)
SELECT tests.is((SELECT count(*)::int FROM u), 0, 'an approved doctor cannot edit their own verification');

SELECT tests.login(:'pat');
SELECT tests.is((SELECT count(*)::int FROM public.doctor_profiles), 1, 'patients see the verified doctor');

-- Rejected doctor resubmits
SELECT tests.login(:'fake');
UPDATE public.doctor_verifications SET registration_number = 'MP777' WHERE doctor_id = auth.uid();
SELECT tests.is((SELECT status::text FROM public.doctor_verifications), 'pending', 'a rejected doctor''s resubmission goes back to pending');

SELECT tests.anon();
SELECT tests.is((SELECT count(*)::int FROM public.doctor_verifications), 0, 'anonymous visitors see no verifications');
