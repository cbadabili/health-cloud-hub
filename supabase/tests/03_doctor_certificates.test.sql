-- 20261123210000-doctor-certificates.sql: private certificate storage for doctor verification.

SELECT tests.create_user('admin@x') AS admin \gset
UPDATE public.user_roles SET role = 'super_admin' WHERE user_id = :'admin';
SELECT tests.create_user('doc1@x', '{"role":"doctor","registration_council":"BHPC","registration_number":"BHPC-4471"}') AS doc1 \gset
SELECT tests.create_user('doc2@x', '{"role":"doctor"}') AS doc2 \gset
SELECT tests.create_user('pat@x', '{"role":"patient"}') AS pat \gset

SELECT tests.ok((SELECT NOT public AND file_size_limit = 5242880 AND allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/png']
  FROM storage.buckets WHERE id = 'doctor-certificates'), 'bucket is private, 5 MB, PDF/JPG/PNG only');

SELECT tests.login(:'doc1');
INSERT INTO storage.objects (bucket_id, name) VALUES ('doctor-certificates', :'doc1' || '/1700-cert.pdf');
SELECT tests.is((SELECT count(*)::int FROM storage.objects), 1, 'a doctor can upload to their own folder');
SELECT tests.throws(format($f$ INSERT INTO storage.objects (bucket_id, name) VALUES ('doctor-certificates', %L) $f$, :'doc2' || '/evil.pdf'),
  'row-level security', 'a doctor cannot upload into another doctor''s folder');
SELECT tests.throws($$ INSERT INTO storage.objects (bucket_id, name) VALUES ('doctor-certificates', 'root.pdf') $$,
  'row-level security', 'a doctor cannot upload to the bucket root');
UPDATE public.doctor_verifications SET certificate_path = :'doc1' || '/1700-cert.pdf' WHERE doctor_id = auth.uid();
SELECT tests.is((SELECT status::text FROM public.doctor_verifications), 'pending', 'attaching a certificate while pending keeps it pending');
SELECT tests.throws(format($f$ UPDATE public.doctor_verifications SET certificate_path = %L WHERE doctor_id = auth.uid() $f$, :'doc2' || '/x.pdf'),
  'own folder', 'certificate_path cannot point into another doctor''s folder');

SELECT tests.login(:'doc2');
SELECT tests.is((SELECT count(*)::int FROM storage.objects), 0, 'doctors cannot see each other''s certificates');

SELECT tests.login(:'pat');
SELECT tests.throws(format($f$ INSERT INTO storage.objects (bucket_id, name) VALUES ('doctor-certificates', %L) $f$, :'pat' || '/x.pdf'),
  'row-level security', 'patients cannot upload certificates');
SELECT tests.is((SELECT count(*)::int FROM storage.objects), 0, 'patients cannot see certificates');

SELECT tests.login(:'admin');
SELECT tests.is((SELECT count(*)::int FROM storage.objects), 1, 'admins can see certificates');
UPDATE public.doctor_verifications SET status = 'approved' WHERE doctor_id = :'doc1';

SELECT tests.login(:'doc1');
WITH d AS (DELETE FROM storage.objects WHERE bucket_id = 'doctor-certificates' RETURNING 1)
SELECT tests.is((SELECT count(*)::int FROM d), 0, 'an approved doctor cannot delete the evidence');
WITH u AS (UPDATE public.doctor_verifications SET certificate_path = NULL WHERE doctor_id = auth.uid() RETURNING 1)
SELECT tests.is((SELECT count(*)::int FROM u), 0, 'an approved doctor cannot swap the certificate');

SELECT tests.login(:'doc2');
INSERT INTO storage.objects (bucket_id, name) VALUES ('doctor-certificates', :'doc2' || '/a.png');
WITH d AS (DELETE FROM storage.objects WHERE name LIKE :'doc2' || '/%' RETURNING 1)
SELECT tests.is((SELECT count(*)::int FROM d), 1, 'an unapproved doctor can delete their own file');
UPDATE public.doctor_verifications SET council = 'HPCSA', registration_number = 'MP1', status = 'approved' WHERE doctor_id = auth.uid();
SELECT tests.is((SELECT status::text FROM public.doctor_verifications), 'pending', 'editing while pending cannot be used to self-approve');
