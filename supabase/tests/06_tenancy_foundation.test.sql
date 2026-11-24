-- 20261125090000-tenancy-foundation.sql: practices, staff roles, site scope, MFA,
-- patient registry, merge, portal links, cross-practice integrity and audit.

-- People ------------------------------------------------------------------------------
SELECT tests.create_user('owner.a@x', '{"role":"doctor","first_name":"Naledi","last_name":"Molefe","registration_council":"BHPC","registration_number":"BHPC-1"}') AS owner_a \gset
SELECT tests.create_user('owner.b@x', '{"role":"doctor","first_name":"Pieter","last_name":"Smit","registration_council":"HPCSA","registration_number":"MP1"}') AS owner_b \gset
SELECT tests.create_user('manager.a@x') AS manager_a \gset
SELECT tests.create_user('manager.only@x') AS manager_only \gset
SELECT tests.create_user('desk.a@x') AS desk_a \gset
SELECT tests.create_user('desk.site1@x') AS desk_site1 \gset
SELECT tests.create_user('nurse.a@x') AS nurse_a \gset
SELECT tests.create_user('biller.a@x') AS biller_a \gset
SELECT tests.create_user('clin.unverified@x', '{"role":"doctor"}') AS clin_unverified \gset
SELECT tests.create_user('portal@x', '{"role":"patient","first_name":"Kabo","last_name":"Sebina"}') AS portal_user \gset
UPDATE public.doctor_verifications SET status = 'approved' WHERE doctor_id IN (:'owner_a', :'owner_b');

-- Practice setup ----------------------------------------------------------------------
SELECT tests.login(:'owner_a');
SELECT public.create_practice('Gaborone Family Clinic', 'BW', 'Main') AS pa \gset
SELECT tests.login(:'owner_b');
SELECT public.create_practice('Cape Town GP', 'ZA') AS pb \gset
SELECT tests.login(:'manager_only');
SELECT public.create_practice('Admin Run Clinic', 'BW') AS pc \gset
SELECT tests.logout();

SELECT tests.ok((SELECT currency = 'BWP' AND timezone = 'Africa/Gaborone' AND require_mfa FROM public.practices WHERE id = :'pa'),
  'a Botswana practice gets BWP, Africa/Gaborone and MFA on');
SELECT tests.ok((SELECT currency = 'ZAR' AND timezone = 'Africa/Johannesburg' FROM public.practices WHERE id = :'pb'),
  'a South African practice gets ZAR and Africa/Johannesburg');
SELECT tests.is((SELECT string_agg(role::text, ',' ORDER BY role) FROM public.staff_memberships WHERE practice_id = :'pa'),
  'owner,clinician', 'a practitioner creating a practice becomes owner and clinician');
SELECT tests.is((SELECT count(*)::int FROM public.providers WHERE practice_id = :'pa'), 1, '...with a provider record');
SELECT tests.is((SELECT string_agg(role::text, ',') FROM public.staff_memberships WHERE practice_id = :'pc'),
  'owner', 'a non-practitioner creating a practice becomes owner only');

SELECT id AS site_a1 FROM public.sites WHERE practice_id = :'pa' \gset
INSERT INTO public.sites (practice_id, name, timezone) VALUES (:'pa', 'Branch', 'Africa/Gaborone') RETURNING id AS site_a2 \gset
SELECT id AS site_b FROM public.sites WHERE practice_id = :'pb' \gset
SELECT id AS provider_a FROM public.providers WHERE practice_id = :'pa' \gset
SELECT id AS provider_b FROM public.providers WHERE practice_id = :'pb' \gset
SELECT tests.add_staff(:'pa', :'manager_a', 'manager') AS m_manager_a \gset
SELECT tests.add_staff(:'pa', :'desk_a', 'receptionist') AS m_desk_a \gset
SELECT tests.add_staff(:'pa', :'desk_site1', 'receptionist', ARRAY[:'site_a1']::uuid[]) AS m_desk_site1 \gset
SELECT tests.add_staff(:'pa', :'nurse_a', 'nurse') AS m_nurse_a \gset
SELECT tests.add_staff(:'pa', :'biller_a', 'biller') AS m_biller_a \gset
SELECT tests.add_staff(:'pa', :'clin_unverified', 'clinician') AS m_clin_unverified \gset
SELECT id AS provider_unverified FROM public.providers WHERE user_id = :'clin_unverified' \gset

-- MFA -----------------------------------------------------------------------------------
SELECT tests.login(:'desk_a', 'aal1');
SELECT tests.is((SELECT count(*)::int FROM public.my_practices()), 1, 'my_practices works before MFA so the app can ask for it');
SELECT tests.ok((SELECT require_mfa FROM public.my_practices()), '...and says MFA is required');
SELECT tests.is((SELECT count(*)::int FROM public.practices), 0, 'without MFA (aal1) staff see no practice data');
SELECT tests.login(:'desk_a', 'aal2');
SELECT tests.is((SELECT count(*)::int FROM public.practices), 1, 'with MFA (aal2) staff see their practice');
SELECT tests.login(:'manager_only', 'aal2');
UPDATE public.practices SET require_mfa = false WHERE id = :'pc';
SELECT tests.login(:'manager_only', 'aal1');
SELECT tests.is((SELECT count(*)::int FROM public.practices), 1, 'a practice that switches MFA off allows aal1');

-- Practice settings and staff directory ------------------------------------------------------
SELECT tests.login(:'owner_a', 'aal2');
UPDATE public.practices SET legal_name = 'GFC (Pty) Ltd' WHERE id = :'pa';
SELECT tests.is((SELECT legal_name FROM public.practices WHERE id = :'pa'), 'GFC (Pty) Ltd', 'owners can edit practice details');
SELECT tests.throws(format($f$ UPDATE public.practices SET currency = 'ZAR' WHERE id = %L $f$, :'pa'), 'permission denied', 'currency is fixed after setup');
SELECT tests.throws(format($f$ UPDATE public.practices SET country = 'ZA' WHERE id = %L $f$, :'pa'), 'permission denied', 'country is fixed after setup');
SELECT tests.is((SELECT count(*)::int FROM public.practice_staff_directory(:'pa')), 8, 'the staff directory lists every membership');
SELECT tests.ok((SELECT bool_and(email IS NOT NULL) FROM public.practice_staff_directory(:'pa')), '...with names and emails');
SELECT tests.login(:'desk_a', 'aal2');
SELECT tests.is((SELECT count(*)::int FROM public.practice_staff_directory(:'pa')), 0, 'reception cannot list staff');
SELECT tests.login(:'owner_b', 'aal2');
SELECT tests.is((SELECT count(*)::int FROM public.practice_staff_directory(:'pa')), 0, 'another practice cannot list staff');

-- Patient registry --------------------------------------------------------------------------
SELECT tests.login(:'desk_a', 'aal2');
SELECT (public.register_patient(:'pa', 'Ayanda', 'Dube', '1990-04-01', 'female', 'omang', '123456789', '+26771234567'))->>'patient_id' AS pat_a \gset
SELECT tests.ok(:'pat_a' <> '', 'reception registers a patient');
SELECT tests.ok((public.register_patient(:'pa', 'Thabo', 'Kgosi'))->>'patient_id' IS NOT NULL, 'registration works without a national ID, phone or birth date');
SELECT (public.register_patient(:'pa', 'Lesedi', 'Moyo', NULL, NULL, 'none', 'X99887'))->>'patient_id' AS pat_other \gset
SELECT tests.is((SELECT id_type::text FROM public.patients WHERE id = :'pat_other'), 'other', 'an ID number with type "none" is stored as "other"');
SELECT public.register_patient(:'pa', 'Ayanda', 'Dube', '1990-04-01', NULL, 'none', NULL, '+26771234567') AS dupe_result \gset
SELECT tests.ok((:'dupe_result'::jsonb)->>'patient_id' IS NULL AND jsonb_array_length((:'dupe_result'::jsonb)->'duplicates') = 1,
  'a likely duplicate is not created; the match is returned for review');
SELECT tests.is((:'dupe_result'::jsonb)->'duplicates'->0->>'reason', 'same_phone', '...with the reason');
SELECT tests.is(jsonb_array_length((public.register_patient(:'pa', 'A', 'Other', NULL, NULL, 'omang', '123456789'))->'duplicates'), 1,
  'the same ID number is flagged');
SELECT tests.is(jsonb_array_length((public.register_patient(:'pa', 'Ayanda', 'DUBE', '1990-04-01'))->'duplicates'), 1,
  'the same birth date and surname is flagged');
SELECT (public.register_patient(:'pa', 'Ayanda', 'Dube', '1990-04-01', NULL, 'none', NULL, '+26771234567', NULL, NULL, true))->>'patient_id' AS pat_a_dupe \gset
SELECT tests.ok(:'pat_a_dupe' <> '', 'staff can confirm it is a different person and register anyway');
SELECT tests.throws($$ INSERT INTO public.patients (practice_id, first_name, last_name) SELECT practice_id, 'X', 'Y' FROM public.patients LIMIT 1 $$,
  'row-level security|permission denied', 'patients cannot be inserted directly (only via register_patient)');
UPDATE public.patients SET phone_e164 = '+26772000000' WHERE id = :'pat_a_dupe';
SELECT tests.is((SELECT phone_e164 FROM public.patients WHERE id = :'pat_a_dupe'), '+26772000000', 'reception can edit demographics');
SELECT tests.throws(format($f$ UPDATE public.patients SET status = 'merged', merged_into = %L WHERE id = %L $f$, :'pat_a', :'pat_a_dupe'),
  'permission denied', 'reception cannot mark a patient merged directly');
SELECT tests.throws($$ UPDATE public.patients SET phone_e164 = '0712345' $$, 'check constraint', 'phone numbers must be E.164');

SELECT tests.login(:'biller_a', 'aal2');
SELECT tests.throws(format($f$ SELECT public.register_patient(%L, 'No', 'Access') $f$, :'pa'), 'NOT_ALLOWED', 'billers cannot register patients');

-- Practice B data, for isolation checks.
SELECT tests.login(:'owner_b', 'aal2');
SELECT (public.register_patient(:'pb', 'Pieter', 'Botha'))->>'patient_id' AS pat_b \gset
SELECT tests.logout();
INSERT INTO public.appointments (practice_id, site_id, patient_id, provider_id, appointment_date, appointment_type)
  VALUES (:'pb', :'site_b', :'pat_b', :'provider_b', now() + interval '1 day', 'in_person');
INSERT INTO public.medical_records (practice_id, patient_id, provider_id, diagnosis) VALUES (:'pb', :'pat_b', :'provider_b', 'B diagnosis');
INSERT INTO public.invoices (practice_id, patient_id, provider_id, invoice_number, amount) VALUES (:'pb', :'pat_b', :'provider_b', 'B-1', 500);

-- Practice A clinical data at two sites.
INSERT INTO public.appointments (practice_id, site_id, patient_id, provider_id, appointment_date, appointment_type)
  VALUES (:'pa', :'site_a1', :'pat_a', :'provider_a', now() + interval '1 day', 'in_person'),
         (:'pa', :'site_a2', :'pat_a', :'provider_a', now() + interval '2 days', 'in_person');

-- Cross-practice integrity (enforced even for privileged writes) -----------------------------
SELECT tests.throws(format($f$ INSERT INTO public.appointments (practice_id, site_id, patient_id, provider_id, appointment_date, appointment_type)
  VALUES (%L, %L, %L, %L, now(), 'in_person') $f$, :'pa', :'site_a1', :'pat_b', :'provider_a'), 'CROSS_PRACTICE_REFERENCE: patient',
  'an appointment cannot use another practice''s patient');
SELECT tests.throws(format($f$ INSERT INTO public.appointments (practice_id, site_id, patient_id, provider_id, appointment_date, appointment_type)
  VALUES (%L, %L, %L, %L, now(), 'in_person') $f$, :'pa', :'site_b', :'pat_a', :'provider_a'), 'CROSS_PRACTICE_REFERENCE: site',
  '...or another practice''s site');
SELECT tests.throws(format($f$ UPDATE public.patients SET practice_id = %L WHERE id = %L $f$, :'pb', :'pat_a'), 'PRACTICE_IS_IMMUTABLE',
  'a record cannot be moved to another practice');

-- Clinical access by role ----------------------------------------------------------------------
SELECT tests.login(:'owner_a', 'aal2');
INSERT INTO public.medical_records (practice_id, site_id, patient_id, provider_id, diagnosis)
  VALUES (:'pa', :'site_a1', :'pat_a', :'provider_a', 'Hypertension');
SELECT tests.is((SELECT count(*)::int FROM public.medical_records), 1, 'a verified clinician writes and reads their own record');
SELECT tests.throws(format($f$ INSERT INTO public.medical_records (practice_id, patient_id, provider_id, diagnosis) VALUES (%L, %L, %L, 'x') $f$,
  :'pa', :'pat_a', :'provider_unverified'), 'row-level security', 'a clinician cannot write a record as another provider');
SELECT tests.throws(format($f$ INSERT INTO public.medical_records (practice_id, patient_id, provider_id, diagnosis) VALUES (%L, %L, %L, 'x') $f$,
  :'pb', :'pat_b', :'provider_b'), 'row-level security|CROSS_PRACTICE', 'a clinician cannot write into another practice');
INSERT INTO public.invoices (practice_id, site_id, patient_id, provider_id, invoice_number, amount) VALUES (:'pa', :'site_a1', :'pat_a', :'provider_a', 'A-1', 450);
SELECT tests.is((SELECT currency::text FROM public.invoices), 'BWP', 'invoices default to the practice currency');

SELECT tests.login(:'clin_unverified', 'aal2');
SELECT tests.throws(format($f$ INSERT INTO public.medical_records (practice_id, patient_id, provider_id, diagnosis) VALUES (%L, %L, %L, 'x') $f$,
  :'pa', :'pat_a', :'provider_unverified'), 'row-level security', 'an unverified clinician cannot write records');

SELECT tests.login(:'nurse_a', 'aal2');
SELECT tests.is((SELECT count(*)::int FROM public.medical_records), 1, 'nurses can read clinical records');
SELECT tests.is((SELECT count(*)::int FROM public.invoices), 0, 'nurses cannot read invoices');

SELECT tests.login(:'desk_a', 'aal2');
SELECT tests.is((SELECT count(*)::int FROM public.medical_records), 0, 'reception cannot read clinical records');
SELECT tests.is((SELECT count(*)::int FROM public.prescriptions), 0, 'reception cannot read prescriptions');
SELECT tests.is((SELECT count(*)::int FROM public.appointments), 2, 'reception sees appointments at all sites');

SELECT tests.login(:'biller_a', 'aal2');
SELECT tests.is((SELECT count(*)::int FROM public.medical_records), 0, 'billers cannot read clinical records');
SELECT tests.is((SELECT count(*)::int FROM public.invoices), 1, 'billers read their practice''s invoices');

-- Site scope ------------------------------------------------------------------------------
SELECT tests.login(:'desk_site1', 'aal2');
SELECT tests.is((SELECT count(*)::int FROM public.appointments), 1, 'a site-scoped receptionist sees only their site''s appointments');
SELECT tests.is((SELECT count(*)::int FROM public.patients WHERE practice_id = :'pa') > 0, true, '...but can still find practice patients');

-- Tenant isolation: practice A staff see nothing of practice B -----------------------------
SELECT tests.login(:'owner_a', 'aal2');
SELECT tests.is((SELECT count(*)::int FROM public.practices WHERE id = :'pb')
              + (SELECT count(*)::int FROM public.tenants WHERE id = (SELECT tenant_id FROM public.practices WHERE id = :'pb'))
              + (SELECT count(*)::int FROM public.sites WHERE practice_id = :'pb')
              + (SELECT count(*)::int FROM public.staff_memberships WHERE practice_id = :'pb')
              + (SELECT count(*)::int FROM public.providers WHERE practice_id = :'pb')
              + (SELECT count(*)::int FROM public.patients WHERE practice_id = :'pb')
              + (SELECT count(*)::int FROM public.appointments WHERE practice_id = :'pb')
              + (SELECT count(*)::int FROM public.medical_records WHERE practice_id = :'pb')
              + (SELECT count(*)::int FROM public.invoices WHERE practice_id = :'pb')
              + (SELECT count(*)::int FROM public.audit_events WHERE practice_id = :'pb'), 0,
  'an owner of practice A sees no rows of practice B in any table');
SELECT tests.is((SELECT count(*)::int FROM public.find_patient_duplicates(:'pb', 'Pieter', 'Botha', NULL, 'none', NULL, NULL)), 0,
  'functions don''t leak another practice''s patients');
SELECT tests.throws(format($f$ SELECT public.register_patient(%L, 'X', 'Y') $f$, :'pb'), 'NOT_ALLOWED', 'cannot register patients in another practice');
SELECT tests.throws(format($f$ SELECT public.log_patient_view(%L) $f$, :'pat_b'), 'NOT_ALLOWED', 'cannot view another practice''s patient');

-- Invitations ---------------------------------------------------------------------------
SELECT tests.create_user('new.desk@x') AS new_desk \gset
SELECT tests.create_user('new.clin@x', '{"role":"doctor","first_name":"Lerato"}') AS new_clin \gset
SELECT tests.create_user('intruder@x') AS intruder \gset
SELECT tests.login(:'manager_a', 'aal2');
SELECT public.invite_staff(:'pa', 'New.Desk@X ', 'receptionist', false, ARRAY[:'site_a2']::uuid[]) AS desk_token \gset
SELECT public.invite_staff(:'pa', 'new.clin@x', 'clinician') AS clin_token \gset
SELECT tests.throws(format($f$ SELECT public.invite_staff(%L, 'boss@x', 'owner') $f$, :'pa'), 'ONLY_OWNERS_CAN_INVITE_OWNERS', 'managers cannot invite owners');
SELECT tests.ok((SELECT bool_and(token_hash <> :'desk_token' AND token_hash <> :'clin_token') FROM public.staff_invitations), 'only token hashes are stored');
SELECT tests.login(:'desk_a', 'aal2');
SELECT tests.throws(format($f$ SELECT public.invite_staff(%L, 'x@x', 'receptionist') $f$, :'pa'), 'NOT_ALLOWED', 'reception cannot invite staff');

SELECT tests.anon();
SELECT tests.ok((SELECT practice_name = 'Gaborone Family Clinic' AND role = 'receptionist' AND email = 'new.desk@x' AND status = 'open'
  FROM public.invitation_preview(:'desk_token')), 'an invitation link can be previewed before signing in');
SELECT tests.is((SELECT count(*)::int FROM public.invitation_preview('made-up-token')), 0, 'a made-up token previews nothing');
SELECT tests.login(:'intruder');
SELECT tests.throws(format($f$ SELECT public.accept_invitation(%L) $f$, :'desk_token'), 'INVITATION_EMAIL_MISMATCH', 'an invitation only works for its email');
SELECT tests.login(:'new_desk');
SELECT tests.is(public.accept_invitation(:'desk_token'), :'pa'::uuid, 'the invited person accepts');
SELECT tests.throws(format($f$ SELECT public.accept_invitation(%L) $f$, :'desk_token'), 'INVITATION_ALREADY_USED', 'an invitation cannot be reused');
SELECT tests.is((SELECT count(*)::int FROM public.membership_sites ms JOIN public.staff_memberships m ON m.id = ms.membership_id
  WHERE m.user_id = :'new_desk' AND ms.site_id = :'site_a2'), 1, 'site scope from the invitation is applied');
SELECT tests.login(:'new_desk', 'aal2');
SELECT tests.is((SELECT count(*)::int FROM public.appointments), 1, 'the new site-scoped receptionist sees only that site');
SELECT tests.login(:'new_clin');
SELECT public.accept_invitation(:'clin_token');
SELECT tests.logout();
SELECT tests.is((SELECT count(*)::int FROM public.providers WHERE user_id = :'new_clin' AND practice_id = :'pa'), 1, 'accepting a clinician invitation creates a provider');

SELECT tests.login(:'manager_a', 'aal2');
SELECT public.invite_staff(:'pa', 'late@x', 'nurse') AS late_token \gset
SELECT public.invite_staff(:'pa', 'revoked@x', 'nurse') AS revoked_token \gset
SELECT public.revoke_invitation((SELECT id FROM public.staff_invitations WHERE email = 'revoked@x'));
SELECT tests.logout();
UPDATE public.staff_invitations SET expires_at = now() - interval '1 minute' WHERE email = 'late@x';
SELECT tests.create_user('late@x') AS late \gset
SELECT tests.create_user('revoked@x') AS revoked \gset
SELECT tests.login(:'late');
SELECT tests.throws(format($f$ SELECT public.accept_invitation(%L) $f$, :'late_token'), 'INVITATION_EXPIRED', 'an expired invitation is refused');
SELECT tests.login(:'revoked');
SELECT tests.throws(format($f$ SELECT public.accept_invitation(%L) $f$, :'revoked_token'), 'INVITATION_NOT_FOUND', 'a revoked invitation is refused');
SELECT tests.throws($$ SELECT public.accept_invitation('not-a-real-token') $$, 'INVITATION_NOT_FOUND', 'a made-up token is refused');
SELECT tests.is((SELECT status FROM public.invitation_preview(:'late_token')), 'expired', 'the preview says when an invitation has expired');
SELECT tests.is((SELECT status FROM public.invitation_preview(:'desk_token')), 'used', '...or has been used');

-- Deactivation ----------------------------------------------------------------------------
SELECT tests.login(:'manager_a', 'aal2');
SELECT public.deactivate_staff(:'m_desk_a');
SELECT tests.login(:'desk_a', 'aal2');
SELECT tests.is((SELECT count(*)::int FROM public.patients) + (SELECT count(*)::int FROM public.appointments), 0,
  'a deactivated member loses access on the next query');
SELECT tests.is((SELECT count(*)::int FROM public.my_practices()), 0, '...and the practice disappears from their list');
SELECT tests.login(:'manager_a', 'aal2');
SELECT tests.throws(format($f$ SELECT public.deactivate_staff(%L) $f$, (SELECT id FROM public.staff_memberships WHERE user_id = :'owner_a' AND role = 'owner')),
  'ONLY_OWNERS_CAN_REMOVE_OWNERS', 'managers cannot remove owners');
SELECT tests.login(:'owner_a', 'aal2');
SELECT tests.throws(format($f$ SELECT public.deactivate_staff(%L) $f$, (SELECT id FROM public.staff_memberships WHERE user_id = :'owner_a' AND role = 'owner')),
  'LAST_OWNER', 'the last owner cannot be removed');
SELECT public.set_staff_sites(:'m_desk_site1', false, ARRAY[:'site_a2']::uuid[]);
SELECT tests.login(:'desk_site1', 'aal2');
SELECT tests.is((SELECT count(*)::int FROM public.appointments WHERE site_id = :'site_a2'), 1, 'changing a member''s sites takes effect immediately');

-- Merge ---------------------------------------------------------------------------------
SELECT tests.logout();
INSERT INTO public.patient_contacts (practice_id, patient_id, relationship, name, is_responsible_party)
  VALUES (:'pa', :'pat_a_dupe', 'mother', 'Mpho Dube', true);
INSERT INTO public.appointments (practice_id, site_id, patient_id, provider_id, appointment_date, appointment_type)
  VALUES (:'pa', :'site_a1', :'pat_a_dupe', :'provider_a', now() + interval '3 days', 'in_person');
INSERT INTO public.patient_portal_links (practice_id, patient_id, user_id, status, verified_at)
  VALUES (:'pa', :'pat_a_dupe', :'portal_user', 'verified', now());

SELECT tests.login(:'portal_user');
SELECT tests.is((SELECT count(*)::int FROM public.patients), 1, 'a verified portal link sees its patient record');

SELECT tests.login(:'nurse_a', 'aal2');
SELECT tests.throws(format($f$ SELECT public.merge_patients(%L, %L, 'same person') $f$, :'pat_a', :'pat_a_dupe'), 'NOT_ALLOWED', 'only owners and managers can merge');
SELECT tests.login(:'manager_a', 'aal2');
SELECT tests.throws(format($f$ SELECT public.merge_patients(%L, %L, '') $f$, :'pat_a', :'pat_a_dupe'), 'REASON_REQUIRED', 'a merge needs a reason');
SELECT tests.throws(format($f$ SELECT public.merge_patients(%L, %L, 'same person') $f$, :'pat_a', :'pat_b'), 'CROSS_PRACTICE|INVALID', 'patients in different practices cannot be merged');
SELECT public.merge_patients(:'pat_a', :'pat_a_dupe', 'Same person registered twice');
SELECT tests.logout();
SELECT tests.ok((SELECT status = 'merged' AND merged_into = :'pat_a' FROM public.patients WHERE id = :'pat_a_dupe'), 'the duplicate is marked merged, not deleted');
SELECT tests.is((SELECT count(*)::int FROM public.appointments WHERE patient_id = :'pat_a_dupe'), 0, 'its appointments move to the kept record');
SELECT tests.is((SELECT count(*)::int FROM public.patient_contacts WHERE patient_id = :'pat_a'), 1, 'its contacts move');
SELECT tests.is((SELECT status::text FROM public.patient_portal_links WHERE user_id = :'portal_user'), 'pending', 'portal links move and must be re-verified');
SELECT tests.ok((SELECT metadata->>'reason' = 'Same person registered twice' FROM public.audit_events WHERE action = 'patients.merge'), 'the merge is audited with its reason');
SELECT tests.login(:'portal_user');
SELECT tests.is((SELECT count(*)::int FROM public.patients) + (SELECT count(*)::int FROM public.medical_records), 0,
  'a pending link cannot see a staff-created record');
SELECT tests.login(:'manager_a', 'aal2');
SELECT public.verify_portal_link((SELECT id FROM public.patient_portal_links WHERE user_id = :'portal_user'));
SELECT tests.login(:'portal_user');
SELECT tests.is((SELECT count(*)::int FROM public.medical_records), 1, 'after reception verifies the link, the patient sees their records');
SELECT tests.is((SELECT count(*)::int FROM public.invoices), 1, '...and invoices');

-- Audit trail -------------------------------------------------------------------------------
SELECT tests.login(:'owner_a', 'aal2');
SELECT public.log_patient_view(:'pat_a');
SELECT tests.ok((SELECT count(*) > 0 FROM public.audit_events WHERE action = 'patients.insert'), 'patient registrations are audited');
SELECT tests.ok((SELECT metadata->'changed' ? 'phone_e164' FROM public.audit_events WHERE action = 'patients.update' AND target_id = :'pat_a_dupe' ORDER BY id LIMIT 1),
  'updates record which columns changed');
SELECT tests.ok((SELECT bool_and(NOT (metadata::text LIKE '%+2677%' OR metadata::text LIKE '%Hypertension%')) FROM public.audit_events),
  'audit metadata contains no values (no phone numbers or diagnoses)');
SELECT tests.ok((SELECT count(*) = 1 FROM public.audit_events WHERE action = 'patients.view' AND actor_user_id = :'owner_a'), 'chart opens are audited');
SELECT tests.ok((SELECT count(*) > 0 FROM public.audit_events WHERE action = 'staff_memberships.update'), 'staff changes are audited');
SELECT tests.ok((SELECT count(*) > 0 FROM public.audit_events WHERE action = 'patients.registered_despite_duplicates'), 'overriding a duplicate warning is audited');
SELECT tests.login(:'nurse_a', 'aal2');
SELECT tests.is((SELECT count(*)::int FROM public.audit_events), 0, 'only owners and managers can read the audit log');
SELECT tests.logout();
SELECT tests.throws($$ UPDATE public.audit_events SET action = 'x' $$, 'APPEND_ONLY', 'audit events cannot be edited, even by a superuser');
SELECT tests.throws($$ DELETE FROM public.audit_events $$, 'APPEND_ONLY', 'audit events cannot be deleted');
SELECT tests.throws($$ TRUNCATE public.audit_events $$, 'APPEND_ONLY', 'the audit log cannot be truncated');
SELECT tests.login(:'owner_a', 'aal2');
SELECT tests.throws($$ SELECT public.write_audit_event(NULL, 'fake', NULL, NULL) $$, 'permission denied', 'users cannot write audit events directly');

-- Deleting logins never deletes clinical history -------------------------------------------
SELECT tests.logout();
SELECT tests.throws(format($f$ DELETE FROM auth.users WHERE id = %L $f$, :'owner_a'), 'foreign key', 'a clinician''s login cannot be deleted while they have patient history');
DELETE FROM auth.users WHERE id = :'portal_user';
SELECT tests.ok((SELECT count(*) = 0 FROM public.patient_portal_links WHERE user_id = :'portal_user')
            AND (SELECT count(*) = 1 FROM public.patients WHERE id = :'pat_a'), 'deleting a portal login removes only the link, not the patient');

-- Anonymous visitors see nothing ------------------------------------------------------------
SELECT tests.anon();
SELECT tests.is((SELECT count(*)::int FROM public.practices) + (SELECT count(*)::int FROM public.patients)
              + (SELECT count(*)::int FROM public.appointments) + (SELECT count(*)::int FROM public.audit_events), 0,
  'anonymous visitors see no practice, patient, appointment or audit data');
SELECT tests.throws($$ SELECT * FROM public.my_practices() $$, 'permission denied', 'anonymous visitors cannot call practice functions');

-- Re-running the migration keeps data -------------------------------------------------------
SELECT tests.logout();
SELECT count(*) AS appts_before FROM public.appointments \gset
\ir ../migrations/20261125090000-tenancy-foundation.sql
SELECT tests.is((SELECT count(*) FROM public.appointments), :'appts_before'::bigint, 're-running the migration keeps existing data');
