-- ============================================================
-- Region 17 Ghana — members.subdivision: the third location tier
-- ============================================================
-- The join screen asked for city and country only. State, province,
-- prefecture, county or region -- whatever the country calls its first
-- subdivision -- has real value for the region intelligence layer this
-- schema is heading toward, so it gets its own column rather than being
-- concatenated into city, where it could never be filtered on cleanly.
--
-- Free text, like city: there is no ISO 3166-2 table in this schema to key
-- against, and building one is its own project. Nullable, and never
-- required by the database -- the join screen decides when to ask (some
-- countries, city-states among them, have no such tier at all).
--
-- register_member() gains p_subdivision as an ordinary optional argument,
-- mirroring p_city. It is appended after p_region_interests rather than
-- placed next to p_city: supabase/tests/pass1_invariants.sql calls this
-- function positionally in several places (e.g. `register_member(999003,
-- 'A', NULL, NULL, 'harnessa', 'a@example.test', 1::smallint, 1990::smallint,
-- NULL, NULL, 'UTC')`, eleven args ending at p_timezone), and inserting a
-- parameter earlier in the list would silently shift every argument after it
-- into the wrong slot in those calls. Appending at the end changes none of
-- their meaning. The application itself calls this function with named
-- arguments (supabase.rpc), so it is unaffected either way.
--
-- Even appended, the signature changes (a 15th parameter), which means
-- CREATE OR REPLACE cannot reuse the old catalog entry -- Postgres
-- identifies a function by name *and* argument types, and a 14-argument
-- call no longer matches a 15-argument one. The old signature is dropped
-- explicitly so the two do not coexist as overloads: an overload PostgREST
-- would have to disambiguate on every call is exactly the kind of ambiguity
-- this security-critical function cannot afford.
-- pseudonymize_member()'s signature is unchanged, so it is replaced in
-- place; it only gains a line clearing the new column.
-- ============================================================

ALTER TABLE public.members ADD COLUMN subdivision text;

DROP FUNCTION IF EXISTS public.register_member(integer, text, text, text, text, text, smallint, smallint, character, text, text, connection_type[], connection_type, text[]);

CREATE FUNCTION public.register_member(p_member_number integer, p_first_name text DEFAULT NULL::text, p_last_name text DEFAULT NULL::text, p_display_name text DEFAULT NULL::text, p_handle text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_birth_month smallint DEFAULT NULL::smallint, p_birth_year smallint DEFAULT NULL::smallint, p_country character DEFAULT NULL::bpchar, p_city text DEFAULT NULL::text, p_timezone text DEFAULT 'UTC'::text, p_connection_types connection_type[] DEFAULT '{}'::connection_type[], p_primary_connection connection_type DEFAULT NULL::connection_type, p_region_interests text[] DEFAULT '{}'::text[], p_subdivision text DEFAULT NULL::text)
 RETURNS TABLE(member_id uuid, member_number integer, credential_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
-- ---------------------------------------------------------------------------
-- SECURITY-CRITICAL. READ THIS WHOLE FUNCTION BEFORE CHANGING ANY LINE OF IT.
--
-- This is the only path to a row in public.members. Direct INSERT on that
-- table is revoked from `authenticated` precisely so that this routine, and
-- nothing else, decides who gets a member number. It runs SECURITY DEFINER,
-- so it bypasses RLS: every caller check below is the only thing standing
-- between a signed-in user and an arbitrary member number.
--
-- Three invariants. Do not weaken any of them without a written decision:
--   1. auth.uid() must be present, and one auth account holds at most one
--      member record.
--   2. A member number is only ever issued by claiming an unexpired,
--      unclaimed row in public.number_reservations, in a single atomic
--      UPDATE ... RETURNING. Never trust p_member_number on its own; it is
--      a lookup key into the reservation, not an assignment.
--   3. credential_id is derived here from the claimed reservation. It is
--      never accepted as an argument, and it is permanent once written.
--
-- Sequential member numbers during the founding window are valuable and
-- scriptable. A convenience change here (accepting a number without a
-- reservation, relaxing the expiry, allowing a second record per account)
-- reopens the land grab this function exists to close.
-- ---------------------------------------------------------------------------
DECLARE
  uid uuid := auth.uid();
  res public.number_reservations%ROWTYPE;
  new_id uuid;
  cred text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF EXISTS (SELECT 1 FROM public.members WHERE user_id = uid) THEN
    RAISE EXCEPTION 'This account already holds a member record.' USING ERRCODE = 'unique_violation';
  END IF;

  -- claim the reservation; this is the only path to a member number
  UPDATE public.number_reservations r
     SET claimed_at = now()
   WHERE r.member_number = p_member_number
     AND r.claimed_by IS NULL
     AND r.claimed_at IS NULL
     AND r.expires_at > now()
  RETURNING r.* INTO res;

  IF res.id IS NULL THEN
    RAISE EXCEPTION 'No live reservation for that member number.' USING ERRCODE = 'check_violation';
  END IF;

  cred := public.credential_id(EXTRACT(YEAR FROM now())::int, res.member_number);

  INSERT INTO public.members (
    user_id, member_number, credential_id, handle, first_name, last_name, display_name,
    email, birth_month, birth_year, country, city, subdivision, timezone,
    connection_types, primary_connection, region_interests
  ) VALUES (
    uid, res.member_number, cred, NULLIF(p_handle, '')::citext, p_first_name, p_last_name, p_display_name,
    NULLIF(p_email, '')::citext, p_birth_month, p_birth_year, p_country, p_city, p_subdivision, COALESCE(p_timezone, 'UTC'),
    COALESCE(p_connection_types, '{}'), p_primary_connection, COALESCE(p_region_interests, '{}')
  ) RETURNING id INTO new_id;

  UPDATE public.number_reservations SET claimed_by = new_id WHERE id = res.id;

  RETURN QUERY SELECT new_id, res.member_number, cred;
END; $function$;

REVOKE ALL ON FUNCTION public.register_member(integer, text, text, text, text, text, smallint, smallint, character, text, text, connection_type[], connection_type, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_member(integer, text, text, text, text, text, smallint, smallint, character, text, text, connection_type[], connection_type, text[], text) TO authenticated, service_role;

COMMENT ON FUNCTION public.register_member(integer, text, text, text, text, text, smallint, smallint, character, text, text, connection_type[], connection_type, text[], text) IS
'SECURITY-CRITICAL. The only path to a public.members row. SECURITY DEFINER, so it bypasses RLS. Requires auth.uid(), allows one member record per account, and issues a member number only by atomically claiming an unexpired unclaimed row in number_reservations. credential_id is derived here, never supplied. Read the full body before editing.';

CREATE OR REPLACE FUNCTION public.pseudonymize_member(target uuid, reason text DEFAULT 'member request', actor uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE old_handle citext;
BEGIN
  SELECT handle INTO old_handle FROM public.members WHERE id = target;
  IF old_handle IS NOT NULL THEN
    INSERT INTO public.reserved_handles (handle, reason)
    VALUES (old_handle, 'released') ON CONFLICT (handle) DO NOTHING;
  END IF;

  UPDATE public.members SET
    user_id = NULL,
    handle = NULL,
    first_name = NULL,
    last_name = NULL,
    display_name = NULL,
    email = NULL,
    email_verified_at = NULL,
    birth_month = NULL,
    birth_year = NULL,
    country = NULL,
    city = NULL,
    subdivision = NULL,
    timezone = 'UTC',
    connection_types = '{}',
    primary_connection = NULL,
    region_interests = '{}',
    status = 'erased',
    pseudonymized_at = now()
  WHERE id = target;

  DELETE FROM public.member_profiles WHERE member_id = target;
  DELETE FROM public.member_intent WHERE member_id = target;
  DELETE FROM public.member_settings WHERE member_id = target;
  DELETE FROM public.member_visibility WHERE member_id = target;
  DELETE FROM public.member_gender WHERE member_id = target;

  UPDATE public.member_consents SET revoked_at = now()
   WHERE member_id = target AND revoked_at IS NULL;

  INSERT INTO public.erasure_log (member_id, reason, actor_id)
  VALUES (target, reason, actor);
END; $$;
