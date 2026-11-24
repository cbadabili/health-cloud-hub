-- 20261123180000-restrict-signup-roles.sql: sign-up can only self-select patient or doctor.

SELECT tests.create_user('admin-try@x', '{"role":"super_admin"}') AS admin_try \gset
SELECT tests.create_user('admin-caps@x', '{"role":"SUPER_ADMIN"}') AS admin_caps \gset
SELECT tests.create_user('doc@x', '{"role":"Doctor","first_name":"Naledi"}') AS doc \gset
SELECT tests.create_user('bogus@x', '{"role":"hacker"}') AS bogus \gset
SELECT tests.create_user('plain@x') AS plain \gset

SELECT tests.is((SELECT role::text FROM public.user_roles WHERE user_id = :'admin_try'), 'patient', 'requesting super_admin at sign-up gives patient');
SELECT tests.is((SELECT role::text FROM public.user_roles WHERE user_id = :'admin_caps'), 'patient', 'requesting SUPER_ADMIN (any case) gives patient');
SELECT tests.is((SELECT role::text FROM public.user_roles WHERE user_id = :'doc'), 'doctor', 'doctor (any case) can be self-selected');
SELECT tests.is((SELECT role::text FROM public.user_roles WHERE user_id = :'bogus'), 'patient', 'an invalid role falls back to patient instead of failing sign-up');
SELECT tests.is((SELECT role::text FROM public.user_roles WHERE user_id = :'plain'), 'patient', 'no role gives patient');
SELECT tests.is((SELECT first_name FROM public.profiles WHERE user_id = :'doc'), 'Naledi', 'a profile is created at sign-up');

SELECT tests.login(:'plain');
SELECT tests.throws($$ INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'super_admin') $$,
  'row-level security', 'a user cannot grant themselves a role directly');
SELECT tests.is((SELECT count(*)::int FROM public.user_roles), 1, 'a user sees only their own role');
