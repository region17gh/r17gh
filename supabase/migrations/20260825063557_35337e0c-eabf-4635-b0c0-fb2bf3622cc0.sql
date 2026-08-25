CREATE OR REPLACE FUNCTION public.register_member(p_member_number integer, p_first_name text DEFAULT NULL::text, p_last_name text DEFAULT NULL::text, p_display_name text DEFAULT NULL::text, p_handle text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_birth_month smallint DEFAULT NULL::smallint, p_birth_year smallint DEFAULT NULL::smallint, p_country character DEFAULT NULL::bpchar, p_city text DEFAULT NULL::text, p_timezone text DEFAULT 'UTC'::text, p_connection_types connection_type[] DEFAULT '{}'::connection_type[], p_primary_connection connection_type DEFAULT NULL::connection_type, p_region_interests text[] DEFAULT '{}'::text[])
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
    email, birth_month, birth_year, country, city, timezone,
    connection_types, primary_connection, region_interests
  ) VALUES (
    uid, res.member_number, cred, NULLIF(p_handle, '')::citext, p_first_name, p_last_name, p_display_name,
    NULLIF(p_email, '')::citext, p_birth_month, p_birth_year, p_country, p_city, COALESCE(p_timezone, 'UTC'),
    COALESCE(p_connection_types, '{}'), p_primary_connection, COALESCE(p_region_interests, '{}')
  ) RETURNING id INTO new_id;

  UPDATE public.number_reservations SET claimed_by = new_id WHERE id = res.id;

  RETURN QUERY SELECT new_id, res.member_number, cred;
END; $function$;

COMMENT ON FUNCTION public.register_member(integer, text, text, text, text, text, smallint, smallint, character, text, text, connection_type[], connection_type, text[]) IS
'SECURITY-CRITICAL. The only path to a public.members row. SECURITY DEFINER, so it bypasses RLS. Requires auth.uid(), allows one member record per account, and issues a member number only by atomically claiming an unexpired unclaimed row in number_reservations. credential_id is derived here, never supplied. Read the full body before editing.';

COMMENT ON FUNCTION public.pseudonymize_member(uuid, text, uuid) IS
'Right-to-erasure path. Clears personal data, retires the handle into reserved_handles, sets status to erased, revokes live consents and writes erasure_log. Consent and affirmation rows are deliberately retained as proof; member rows are never deleted.';

COMMENT ON FUNCTION public.report_gender_distribution(integer) IS
'Reporting-only aggregate over member_gender, restricted to the r17_reporting role, with small-cell suppression below min_cell.';