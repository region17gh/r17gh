-- ============================================================
-- Region 17 Ghana — activation is a database decision
--
-- Until this migration, `pending_verification` was enforced nowhere. The
-- browser held the whole rule: /verify read `email_confirmed_at` off the auth
-- session in TypeScript and, if it was set, wrote `status = 'active'` straight
-- onto the member's own row. `authenticated` held UPDATE on every column of
-- public.members, and the RLS policy on it asks only that the row belongs to
-- the caller. The anon key is public, so any signed-in account could send
--
--   PATCH /rest/v1/members?user_id=eq.<uid>   {"status":"active"}
--
-- and skip the check entirely. The same hole let a suspended account restore
-- itself. Conduct and verification were both client-side.
--
-- After this migration a member cannot write their own standing at all, and
-- activation runs through one routine that reads auth.users server-side.
-- ============================================================

-- ============ 1. a member may not write their own standing ============
-- Column-level grants replace the table-wide one. Everything left out is
-- unwritable from the browser: status, email_verified_at, email, user_id,
-- joined_at, class_year, founding_member, member_number, credential_id,
-- handle_changed_at, pseudonymized_at, chapter_id, last_affirmed_at.
-- The triggers on this table still assign class_year, founding_member,
-- handle_changed_at and updated_at; column privileges are checked against the
-- SET list of the statement, not against what a trigger writes, so freezing
-- these out of the grant does not disturb them.
REVOKE UPDATE ON public.members FROM authenticated;
GRANT UPDATE (
  first_name,
  last_name,
  display_name,
  handle,
  country,
  city,
  timezone,
  connection_types,
  primary_connection,
  region_interests
) ON public.members TO authenticated;

-- ============ 2. activation reads the confirmation, never the caller ============
CREATE OR REPLACE FUNCTION public.activate_membership(p_handle text DEFAULT NULL)
RETURNS public.members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
-- ---------------------------------------------------------------------------
-- SECURITY-CRITICAL. The only path from `pending_verification` to `active`.
--
-- SECURITY DEFINER, so it bypasses RLS: the checks below are the whole gate.
--
-- Three invariants. Do not weaken any of them without a written decision:
--   1. Activation depends on auth.users.email_confirmed_at, read here, in the
--      database. GoTrue sets that column only when a code or a link that it
--      emailed is actually used. Nothing the caller sends can stand in for it.
--   2. The confirmed address must be the address on the record. A member who
--      confirms some other inbox does not thereby verify this one.
--   3. Only `pending_verification` moves. `suspended`, `revoked`, `erased` and
--      `dormant` are lifecycle and conduct states, and no member lifts their
--      own. Re-running against an already active record is a no-op that
--      returns the row, so a double submit is not an error.
--
-- The handle is written here only when the record holds none. Filling a null
-- is not a change, so it does not spend the member's one permitted change: the
-- trigger stamps handle_changed_at only when an existing handle is replaced.
-- ---------------------------------------------------------------------------
DECLARE
  uid uuid := auth.uid();
  confirmed timestamptz;
  confirmed_email text;
  m public.members%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT u.email_confirmed_at, u.email
    INTO confirmed, confirmed_email
    FROM auth.users u
   WHERE u.id = uid;

  IF confirmed IS NULL THEN
    RAISE EXCEPTION 'This address has not been confirmed.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO m FROM public.members WHERE user_id = uid;
  IF m.id IS NULL THEN
    RAISE EXCEPTION 'This account has not joined yet.' USING ERRCODE = 'no_data_found';
  END IF;

  -- citext, so this compares without regard to case.
  IF m.email IS NOT NULL AND m.email IS DISTINCT FROM confirmed_email::citext THEN
    RAISE EXCEPTION 'The confirmed address is not the address on this record.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF m.status NOT IN ('pending_verification', 'active') THEN
    RAISE EXCEPTION 'This record is not awaiting verification.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.members SET
    status = 'active',
    -- GoTrue's timestamp, not the caller's clock.
    email_verified_at = COALESCE(email_verified_at, confirmed),
    handle = COALESCE(handle, NULLIF(btrim(p_handle), '')::citext)
   WHERE id = m.id
  RETURNING * INTO m;

  RETURN m;
END; $$;

REVOKE ALL ON FUNCTION public.activate_membership(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_membership(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.activate_membership(text) IS
'SECURITY-CRITICAL. The only path from pending_verification to active. SECURITY DEFINER, so it bypasses RLS. Requires auth.uid(), requires auth.users.email_confirmed_at to be set, requires the confirmed address to match the address on the record, moves only pending_verification, and stamps email_verified_at from GoTrue rather than from the caller. Writes the handle only when the record holds none. Read the full body before editing.';
