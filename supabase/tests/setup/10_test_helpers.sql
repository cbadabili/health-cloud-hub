-- Test helpers, applied after all migrations. Every test file runs in its own
-- fresh copy of the migrated database.
--
-- Act as someone:      SELECT tests.login(user_id);   SELECT tests.login(user_id, 'aal2');
--                      SELECT tests.anon();           SELECT tests.logout();  -- back to superuser
-- Make a user:         SELECT tests.create_user('a@x', '{"role":"doctor"}');   -- runs the sign-up trigger
-- Assert:              SELECT tests.ok(condition, 'description');
--                      SELECT tests.is(actual, expected, 'description');
--                      SELECT tests.throws($$ sql $$, 'error regex', 'description');

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated;

CREATE OR REPLACE FUNCTION tests.create_user(_email TEXT, _meta JSONB DEFAULT '{}'::jsonb, _id UUID DEFAULT gen_random_uuid())
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (_id, _email, _meta);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION tests.user_email(_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT email FROM auth.users WHERE id = _id
$$;

CREATE OR REPLACE FUNCTION tests.login(_id UUID, _aal TEXT DEFAULT 'aal1')
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _id, 'email', tests.user_email(_id), 'role', 'authenticated', 'aal', _aal)::text, false);
  PERFORM set_config('role', 'authenticated', false);
END $$;

CREATE OR REPLACE FUNCTION tests.anon()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', false);
  PERFORM set_config('role', 'anon', false);
END $$;

CREATE OR REPLACE FUNCTION tests.logout()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'none', false);
  PERFORM set_config('request.jwt.claims', '', false);
END $$;

CREATE OR REPLACE FUNCTION tests.ok(_cond BOOLEAN, _description TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF _cond IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'not ok - %', _description;
  END IF;
  RAISE NOTICE 'ok - %', _description;
END $$;

CREATE OR REPLACE FUNCTION tests.is(_actual ANYELEMENT, _expected ANYELEMENT, _description TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF _actual IS DISTINCT FROM _expected THEN
    RAISE EXCEPTION 'not ok - % (expected %, got %)', _description, _expected, _actual;
  END IF;
  RAISE NOTICE 'ok - %', _description;
END $$;

CREATE OR REPLACE FUNCTION tests.throws(_sql TEXT, _pattern TEXT, _description TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE _sql;
  RAISE EXCEPTION 'not ok - % (expected an error matching "%", but it succeeded)', _description, _pattern;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'not ok - %' THEN RAISE; END IF;
  IF SQLERRM !~* _pattern THEN
    RAISE EXCEPTION 'not ok - % (expected an error matching "%", got "%")', _description, _pattern, SQLERRM;
  END IF;
  RAISE NOTICE 'ok - %', _description;
END $$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tests TO anon, authenticated;
