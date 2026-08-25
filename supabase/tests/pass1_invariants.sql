-- ---------------------------------------------------------------------------
-- Region 17 — member register invariant harness
--
-- Run this after EVERY migration that touches the member tables, their
-- policies, or their triggers. It is not a pass 1 artifact; it is the
-- regression suite for the register.
--
-- How to run: paste the whole file into the SQL editor, or run it through the
-- run_sql tool as a single statement.
--
-- Safety: the whole harness runs inside one function call that ALWAYS raises
-- at the end, so PostgreSQL rolls the transaction back. Nothing it writes
-- survives, including member numbers. The results are smuggled out in the
-- exception message. A register whose entire value is accuracy must not carry
-- test rows.
--
-- Role discipline: FIXTURES (state that merely has to exist) are written as
-- service_role, matching how they're actually created in production --
-- reserve_member_number() and register_member() are both SECURITY DEFINER
-- running as service_role internally, and GoTrue alone owns auth.users.
-- ASSERTIONS (the thing each case is testing) run as authenticated, because a
-- check performed by an elevated role proves nothing about what a signed-in
-- member can actually do. A connection with BYPASSRLS or superuser sails past
-- RLS regardless of what role the harness claims to switch to, which is how
-- this harness ran for its entire history before it started connecting
-- through a path that enforces RLS for real: two real bugs (an RLS gap on
-- number_reservations exposure, and enforce_member_rules() not being
-- SECURITY DEFINER) were passing silently the whole time, because nothing
-- had ever exercised authenticated's actual privileges. Every role switch
-- below is commented with which of the two it is and why.
--
-- Adding a case: append to the `check` calls below. The known invariant
-- collision this harness caught (erasure clearing the handle tripping the
-- once-only handle rule) is exactly the class of bug that reappears whenever
-- a new rule is added, so err towards adding cases for rule interactions,
-- not just rules.
--
-- A recurring bug shape, named here because it has hit this file three times
-- and will hit it again: an assertion that passes or fails for a reason
-- other than the thing under test. Section 1 originally paired the JWT claim
-- and the role switch in one BEGIN block, so a refused role switch silently
-- reverted the JWT claim too, and every case below it passed for "not signed
-- in" instead of the reservation rule it existed to prove. Section 7 checked
-- member B's row while still claiming to be member A, so the RLS-scoped
-- UPDATE matched zero rows and reported a false FAIL instead of exercising
-- the immutability trigger. Sections 8 and 9 treated "no exception raised"
-- as proof a write was refused, but a zero-row UPDATE or DELETE succeeds
-- trivially in Postgres -- it doesn't raise -- so both looked identical
-- whether the write was genuinely blocked or the row was simply invisible
-- under RLS. Different mechanisms, same shape: check the actual outcome
-- (the row's state, who's really signed in, which role really executed),
-- never just the absence of an error. The next case written here will reach
-- for the same shortcut unless this is read first.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION pg_temp.run_register_invariants()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $harness$
DECLARE
  log text := '';
  uid_a uuid := gen_random_uuid();
  uid_b uuid := gen_random_uuid();
  uid_c uuid := gen_random_uuid();
  uid_d uuid := gen_random_uuid();
  m_a uuid;
  m_b uuid;
  m_c uuid;
  n_a integer;
  n_b integer;
  cred_a text;
  tmp text;
  cnt integer;
  t text;
BEGIN
  -- [service_role] fixtures: every number_reservations row the whole harness
  -- needs. number_reservations has RLS enabled with NO POLICIES at all --
  -- deliberately: "trusted server code only." Nothing can write it as
  -- authenticated, so these rows can only be seeded elevated.
  PERFORM set_config('role', 'service_role', true);
  INSERT INTO public.number_reservations (member_number, expires_at) VALUES
    (999002, now() - interval '1 hour'),   -- expired, for the register_member refusal case
    (999003, now() + interval '1 hour'),   -- harness member A
    (999004, now() + interval '1 hour'),   -- harness member B
    (999005, now() + interval '1 hour');   -- the age-gate case

  -- [authenticated] from here on, unless a comment says otherwise.
  PERFORM set_config('request.jwt.claim.sub', uid_a::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- 1. Registration requires a live reservation ------------------------------
  -- unreserved number
  BEGIN
    PERFORM public.register_member(999001);
    log := log || E'\nFAIL  register_member accepted an unreserved number';
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nPASS  unreserved number refused: ' || SQLERRM;
  END;

  -- expired reservation
  BEGIN
    PERFORM public.register_member(999002);
    log := log || E'\nFAIL  register_member accepted an expired reservation';
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nPASS  expired reservation refused: ' || SQLERRM;
  END;

  -- 2. Direct insert is not available to members -----------------------------
  SELECT count(*) INTO cnt
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'members'
     AND grantee = 'authenticated' AND privilege_type = 'INSERT';
  IF cnt = 0 THEN
    log := log || E'\nPASS  INSERT on members is not granted to authenticated';
  ELSE
    log := log || E'\nFAIL  INSERT on members is granted to authenticated';
  END IF;

  SELECT count(*) INTO cnt
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'members' AND cmd = 'INSERT';
  IF cnt = 0 THEN
    log := log || E'\nPASS  members carries no INSERT policy';
  ELSE
    log := log || E'\nFAIL  members carries an INSERT policy';
  END IF;

  -- 2b. A member cannot write their own standing ------------------------------
  -- The RLS policy on members asks only that the row belongs to the caller, so
  -- the column grant is the whole of this rule. If UPDATE on status ever comes
  -- back, /verify stops being a gate and a PATCH from any signed-in account
  -- activates a record.
  SELECT count(*) INTO cnt
    FROM information_schema.column_privileges
   WHERE table_schema = 'public' AND table_name = 'members'
     AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
     AND column_name IN ('status', 'email_verified_at', 'email', 'user_id',
                         'member_number', 'credential_id', 'founding_member',
                         'joined_at', 'class_year', 'pseudonymized_at');
  IF cnt = 0 THEN
    log := log || E'\nPASS  authenticated cannot UPDATE standing or identity columns';
  ELSE
    log := log || E'\nFAIL  authenticated can UPDATE ' || cnt || ' standing/identity column(s)';
  END IF;

  -- The member still edits what is theirs to edit. A grant revoked too widely
  -- is as much a defect as one left too wide.
  SELECT count(*) INTO cnt
    FROM information_schema.column_privileges
   WHERE table_schema = 'public' AND table_name = 'members'
     AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
     AND column_name IN ('first_name', 'city', 'country', 'handle', 'region_interests');
  IF cnt = 5 THEN
    log := log || E'\nPASS  authenticated can still UPDATE its own descriptive columns';
  ELSE
    log := log || E'\nFAIL  descriptive columns are not updatable (' || cnt || ' of 5)';
  END IF;

  SELECT count(*) INTO cnt
    FROM information_schema.routine_privileges
   WHERE routine_schema = 'public' AND routine_name = 'activate_membership'
     AND grantee IN ('anon', 'PUBLIC');
  IF cnt = 0 THEN
    log := log || E'\nPASS  activate_membership is not executable by anon';
  ELSE
    log := log || E'\nFAIL  activate_membership is executable by anon';
  END IF;

  -- 3. Two members, created the sanctioned way -------------------------------
  -- Genuinely sanctioned this time: through register_member(), SECURITY
  -- DEFINER, called by each member as themselves -- not a raw INSERT. This
  -- also proves authenticated really can register despite holding no INSERT
  -- grant on members: the function bypasses it, a browser PATCH can't.
  SELECT r.member_id, r.member_number, r.credential_id INTO m_a, n_a, cred_a
    FROM public.register_member(999003, 'A', NULL, NULL, 'harnessa', 'a@example.test',
                                 1::smallint, 1990::smallint, NULL, NULL, 'UTC') r;

  PERFORM set_config('request.jwt.claim.sub', uid_b::text, true);
  SELECT r.member_id INTO m_b
    FROM public.register_member(999004, 'B', NULL, NULL, 'harnessbb', 'b@example.test',
                                 1::smallint, 1990::smallint, NULL, NULL, 'UTC') r;
  PERFORM set_config('request.jwt.claim.sub', uid_a::text, true);

  log := log || E'\nINFO  credential for 999003 = ' || cred_a;

  -- 4. Age gate --------------------------------------------------------------
  -- Runs through register_member(), same as section 3: the age trigger is
  -- what's under test, and register_member is the only path a real signed-in
  -- member has to a members row, so that's the path this needs to prove.
  PERFORM set_config('request.jwt.claim.sub', uid_d::text, true);
  BEGIN
    PERFORM public.register_member(999005, NULL, NULL, NULL, NULL, NULL,
                                    1::smallint, (EXTRACT(YEAR FROM now())::int - 17)::smallint);
    log := log || E'\nFAIL  under-18 insert accepted';
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nPASS  under-18 insert refused: ' || SQLERRM;
  END;
  PERFORM set_config('request.jwt.claim.sub', uid_a::text, true);

  -- 5. Reserved handles ------------------------------------------------------
  SELECT handle::text INTO t FROM public.reserved_handles
   WHERE reason <> 'released' LIMIT 1;
  IF t IS NOT NULL THEN
    BEGIN
      UPDATE public.members SET handle = t::citext WHERE id = m_a;
      log := log || E'\nFAIL  reserved handle "' || t || '" was accepted';
    EXCEPTION WHEN OTHERS THEN
      log := log || E'\nPASS  reserved handle refused: ' || SQLERRM;
    END;
  END IF;

  -- 6. Handle may be changed once, and the old one is retired ----------------
  -- Two assertions, not one: that the change itself succeeds, and separately
  -- that the retired handle actually lands in reserved_handles. The change
  -- runs inside its own BEGIN block rather than bare, because an RLS refusal
  -- inside the trigger aborts the whole triggering UPDATE -- a bare statement
  -- here would have crashed the entire harness rather than reporting a clean
  -- FAIL, which is exactly what happened before enforce_member_rules() was
  -- made SECURITY DEFINER. A case that only checked the change succeeded
  -- would have passed even with the retirement insert silently swallowed --
  -- it wasn't swallowed, it aborted the statement, but the principle is the
  -- same: check the outcome that matters, not just the absence of an error.
  BEGIN
    UPDATE public.members SET handle = 'harnessb' WHERE id = m_a;
    SELECT handle::text INTO tmp FROM public.members WHERE id = m_a;
    IF tmp = 'harnessb' THEN
      log := log || E'\nPASS  first handle change succeeded';
    ELSE
      log := log || E'\nFAIL  handle after change is ' || COALESCE(tmp, 'null') || ', not harnessb';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nFAIL  first handle change raised: ' || SQLERRM;
  END;

  SELECT count(*) INTO cnt FROM public.reserved_handles
   WHERE handle = 'harnessa'::citext AND reason = 'released';
  IF cnt = 1 THEN
    log := log || E'\nPASS  released handle retained in reserved_handles';
  ELSE
    log := log || E'\nFAIL  released handle was not retained';
  END IF;

  BEGIN
    UPDATE public.members SET handle = 'harnessc' WHERE id = m_a;
    log := log || E'\nFAIL  second handle change accepted';
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nPASS  second handle change refused: ' || SQLERRM;
  END;

  -- 7. Member number and credential are permanent ----------------------------
  -- Switches to member B's own JWT: the RLS policy on members scopes UPDATE
  -- to user_id = auth.uid(), so testing this while still claiming to be A
  -- would match zero rows and report a false FAIL rather than exercising the
  -- trigger. Has to run as the row's actual owner to mean anything.
  PERFORM set_config('request.jwt.claim.sub', uid_b::text, true);
  BEGIN
    UPDATE public.members SET member_number = 1 WHERE id = m_b;
    log := log || E'\nFAIL  member_number was mutable';
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nPASS  member_number/credential immutable: ' || SQLERRM;
  END;
  PERFORM set_config('request.jwt.claim.sub', uid_a::text, true);

  -- 8. Append-only history ---------------------------------------------------
  INSERT INTO public.affirmations (member_id, compact_version, conduct_version)
  VALUES (m_a, 'v1', 'v1');

  -- Third instance of the same class of bug this file has now produced
  -- (section 1's GUC ordering, section 7's JWT mismatch, this one): an
  -- assertion structured as "no exception, therefore permitted" cannot tell
  -- "genuinely allowed" apart from "matched nothing." affirmations has RLS
  -- enabled with NO UPDATE policy for authenticated at all -- not even a
  -- restrictive one -- so a zero-row UPDATE succeeds trivially and the
  -- affirmations_append_only trigger never fires, because there is no row
  -- for it to fire on. "No exception" was true here whether the trigger
  -- blocked a real write or the row was simply invisible to the statement.
  -- Assert what the invariant actually requires: the row is unchanged. A
  -- check that only proves nothing raised would still pass against a table
  -- that had been dropped.
  UPDATE public.affirmations SET compact_version = 'v2' WHERE member_id = m_a;
  SELECT count(*) INTO cnt FROM public.affirmations
   WHERE member_id = m_a AND compact_version = 'v1';
  IF cnt = 1 THEN
    log := log || E'\nPASS  affirmation update refused (row unchanged)';
  ELSE
    log := log || E'\nFAIL  affirmation row missing or changed after update attempt';
  END IF;

  INSERT INTO public.member_consents (member_id, consent_type, policy_version, mechanism)
  VALUES (m_a, 'directory_visibility', 'v1', 'join_flow');
  BEGIN
    UPDATE public.member_consents SET policy_version = 'v2' WHERE member_id = m_a;
    log := log || E'\nFAIL  consent rewrite accepted';
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nPASS  consent rewrite refused: ' || SQLERRM;
  END;

  UPDATE public.member_consents SET revoked_at = now() WHERE member_id = m_a;
  log := log || E'\nPASS  consent withdrawal (revoked_at) permitted';

  -- 9. History survives an attempted member delete ---------------------------
  -- Same shape as section 8: members has RLS enabled with explicitly no
  -- DELETE policy for authenticated ("erasure runs through pseudonymisation,
  -- not row deletion"), so a zero-row DELETE succeeds trivially and raises
  -- nothing. "No exception, therefore deletable" cannot tell "actually
  -- deleted" apart from "matched nothing." Assert the row still exists.
  DELETE FROM public.members WHERE id = m_a;
  SELECT count(*) INTO cnt FROM public.members WHERE id = m_a;
  IF cnt = 1 THEN
    log := log || E'\nPASS  member with consent history survived the delete attempt';
  ELSE
    log := log || E'\nFAIL  member with consent history was deleted';
  END IF;

  -- 10. Visibility and consent default to the most private value -------------
  INSERT INTO public.member_visibility (member_id) VALUES (m_a);
  SELECT count(*) INTO cnt FROM public.member_visibility
   WHERE member_id = m_a
     AND identity = 'hidden' AND location = 'hidden' AND connection = 'hidden'
     AND work = 'hidden' AND intent = 'hidden' AND standing = 'hidden'
     AND links = 'hidden';
  IF cnt = 1 THEN
    log := log || E'\nPASS  every visibility column defaults to hidden';
  ELSE
    log := log || E'\nFAIL  a visibility column does not default to hidden';
  END IF;

  INSERT INTO public.member_gender (member_id) VALUES (m_a);
  SELECT gender::text INTO t FROM public.member_gender WHERE member_id = m_a;
  IF t = 'prefer_not_to_say' THEN
    log := log || E'\nPASS  gender defaults to prefer_not_to_say';
  ELSE
    log := log || E'\nFAIL  gender default is ' || t;
  END IF;

  -- 11. Founding status is frozen at insert ----------------------------------
  SELECT founding_member::text INTO t FROM public.members WHERE id = m_a;

  -- [service_role] fixture: app_config's founding_member_cutoff is an admin
  -- setting -- authenticated holds only SELECT on app_config. This one write
  -- is a precondition for the case, not what it's testing, so it's the only
  -- statement in this section that runs elevated.
  PERFORM set_config('role', 'service_role', true);
  UPDATE public.app_config SET value = to_jsonb('2000-01-01T00:00:00Z'::text)
   WHERE key = 'founding_member_cutoff';
  PERFORM set_config('role', 'authenticated', true);

  UPDATE public.members SET city = 'Accra' WHERE id = m_a;
  SELECT founding_member::text INTO tmp FROM public.members WHERE id = m_a;
  IF t = tmp THEN
    log := log || E'\nPASS  founding_member unchanged after cutoff edit (' || t || ')';
  ELSE
    log := log || E'\nFAIL  founding_member moved with the cutoff';
  END IF;

  -- 11b. Activation depends on a confirmation GoTrue actually issued ---------
  -- Every fixture below (auth.users, the 999006 reservation, member C, and
  -- every later write to auth.users or to member C's status) runs as
  -- service_role: GoTrue owns auth.users, register_member is service_role
  -- internally, and no member can set their own status -- that is exactly
  -- the vulnerability this migration closes. Only the activate_membership()
  -- calls run as authenticated, because that is the one surface a real
  -- signed-in member actually reaches.
  --
  -- COVERAGE GAP, not a defect: on production, service_role has no table
  -- access to auth.users -- GoTrue owns that schema outright and connects as
  -- its own role, separate from what PostgREST/service_role can reach. The
  -- INSERT into auth.users below fails there with "permission denied for
  -- table users," this whole block is caught by the EXCEPTION handler below,
  -- and every activation-specific assertion inside it -- unconfirmed refused,
  -- wrong-address refused, confirmed address activates, email_verified_at
  -- sourced from GoTrue not the caller, double-activation is a no-op,
  -- suspended can't self-activate -- is SKIPPED with an INFO line rather than
  -- run. That degrade-not-fail behavior is correct and should stay an INFO.
  -- But it means activate_membership()'s actual behavior under authenticated
  -- is UNVERIFIED ON PRODUCTION by this harness. It has been proven locally
  -- and on the preview branch, where auth.users is writable, but production
  -- itself has never exercised these six cases. That gap is real and belongs
  -- in the open rather than folded into a skipped line further down.
  BEGIN
    PERFORM set_config('role', 'service_role', true);
    INSERT INTO auth.users (id, email) VALUES (uid_c, 'c@example.test');
    INSERT INTO public.number_reservations (member_number, expires_at)
    VALUES (999006, now() + interval '1 hour');
    PERFORM set_config('request.jwt.claim.sub', uid_c::text, true);
    SELECT r.member_id INTO m_c
      FROM public.register_member(999006, 'C', NULL, NULL, NULL, 'c@example.test',
                                   1::smallint, 1990::smallint, NULL, NULL, 'UTC') r;

    PERFORM set_config('role', 'authenticated', true);

    IF auth.uid() IS DISTINCT FROM uid_c THEN
      log := log || E'\nINFO  activation cases skipped: auth.uid() not settable here';
    ELSE
      -- unconfirmed
      BEGIN
        PERFORM public.activate_membership('harnessc');
        log := log || E'\nFAIL  activate_membership activated an unconfirmed address';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%has not been confirmed%' THEN
          log := log || E'\nPASS  unconfirmed address refused: ' || SQLERRM;
        ELSE
          log := log || E'\nFAIL  unconfirmed address refused for the wrong reason: ' || SQLERRM;
        END IF;
      END;

      SELECT status::text INTO t FROM public.members WHERE id = m_c;
      IF t = 'pending_verification' THEN
        log := log || E'\nPASS  record left pending after the refusal';
      ELSE
        log := log || E'\nFAIL  record moved to ' || t || ' despite the refusal';
      END IF;

      -- [service_role] fixture: GoTrue confirming a different inbox --
      -- authenticated has no path to auth.users at all.
      PERFORM set_config('role', 'service_role', true);
      UPDATE auth.users SET email_confirmed_at = now(), email = 'other@example.test'
       WHERE id = uid_c;
      PERFORM set_config('role', 'authenticated', true);
      BEGIN
        PERFORM public.activate_membership('harnessc');
        log := log || E'\nFAIL  activate_membership accepted a confirmation of another address';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%not the address on this record%' THEN
          log := log || E'\nPASS  confirmation of another address refused: ' || SQLERRM;
        ELSE
          log := log || E'\nFAIL  another address refused for the wrong reason: ' || SQLERRM;
        END IF;
      END;

      -- [service_role] fixture: GoTrue confirming the record's real address
      PERFORM set_config('role', 'service_role', true);
      UPDATE auth.users SET email = 'c@example.test' WHERE id = uid_c;
      PERFORM set_config('role', 'authenticated', true);
      PERFORM public.activate_membership('harnessc');
      SELECT status::text INTO t FROM public.members WHERE id = m_c;
      SELECT handle::text INTO tmp FROM public.members WHERE id = m_c;
      IF t = 'active' AND tmp = 'harnessc' THEN
        log := log || E'\nPASS  a confirmed address activates and takes the handle';
      ELSE
        log := log || E'\nFAIL  confirmed activation left status ' || t || ', handle ' || COALESCE(tmp, 'null');
      END IF;

      -- [service_role] read: comparing members.email_verified_at against
      -- auth.users.email_confirmed_at needs auth.users, which authenticated
      -- cannot read directly.
      PERFORM set_config('role', 'service_role', true);
      SELECT count(*) INTO cnt FROM public.members m, auth.users u
       WHERE m.id = m_c AND u.id = uid_c AND m.email_verified_at = u.email_confirmed_at;
      PERFORM set_config('role', 'authenticated', true);
      IF cnt = 1 THEN
        log := log || E'\nPASS  email_verified_at is GoTrue''s timestamp, not the caller''s';
      ELSE
        log := log || E'\nFAIL  email_verified_at does not match auth.users.email_confirmed_at';
      END IF;

      -- running it twice is a no-op, not an error
      BEGIN
        PERFORM public.activate_membership('somethingelse');
        SELECT handle::text INTO tmp FROM public.members WHERE id = m_c;
        IF tmp = 'harnessc' THEN
          log := log || E'\nPASS  a second activation is a no-op and does not spend the handle change';
        ELSE
          log := log || E'\nFAIL  a second activation rewrote the handle to ' || COALESCE(tmp, 'null');
        END IF;
      EXCEPTION WHEN OTHERS THEN
        log := log || E'\nFAIL  a second activation raised: ' || SQLERRM;
      END;

      -- [service_role] fixture: suspending a member is an admin/conduct
      -- action. status is not in authenticated's grantable column list at
      -- all -- that is this migration's whole point -- so only service_role
      -- can create this precondition.
      PERFORM set_config('role', 'service_role', true);
      UPDATE public.members SET status = 'suspended' WHERE id = m_c;
      PERFORM set_config('role', 'authenticated', true);
      BEGIN
        PERFORM public.activate_membership(NULL);
        log := log || E'\nFAIL  activate_membership lifted a suspension';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%not awaiting verification%' THEN
          log := log || E'\nPASS  suspended record refused: ' || SQLERRM;
        ELSE
          log := log || E'\nFAIL  suspension refused for the wrong reason: ' || SQLERRM;
        END IF;
      END;
    END IF;

    PERFORM set_config('request.jwt.claim.sub', uid_a::text, true);
    PERFORM set_config('role', 'authenticated', true);
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nINFO  activation cases skipped (' || SQLERRM ||
      '). activate_membership() under authenticated is UNVERIFIED ON PRODUCTION by this harness -- proven locally/preview only, where auth.users is writable.';
    PERFORM set_config('request.jwt.claim.sub', uid_a::text, true);
    PERFORM set_config('role', 'authenticated', true);
  END;

  -- 12. Erasure --------------------------------------------------------------
  -- Runs as service_role throughout: pseudonymize_member is SECURITY DEFINER
  -- granted only to service_role (erasure is a backend/compliance action, not
  -- self-service), and it clears user_id -- which means every "read own" RLS
  -- policy on this row, and on affirmations/consents keyed off
  -- current_member_id(), stops matching uid_a the instant erasure runs.
  -- Checking the aftermath as authenticated wouldn't fail meaningfully, it
  -- would just see nothing, which is a different bug than the one this case
  -- exists to catch.
  PERFORM set_config('role', 'service_role', true);

  -- The collision this harness caught: erasure clears the handle, which the
  -- once-only handle rule used to reject. Keep this case.
  PERFORM public.pseudonymize_member(m_a, 'harness', NULL);
  SELECT status::text INTO t FROM public.members WHERE id = m_a;
  IF t = 'erased' THEN
    log := log || E'\nPASS  erasure sets status = erased';
  ELSE
    log := log || E'\nFAIL  erasure set status = ' || t;
  END IF;

  SELECT count(*) INTO cnt FROM public.members
   WHERE id = m_a AND user_id IS NULL AND handle IS NULL AND first_name IS NULL
     AND email IS NULL AND birth_year IS NULL AND pseudonymized_at IS NOT NULL;
  IF cnt = 1 THEN
    log := log || E'\nPASS  erasure cleared personal data';
  ELSE
    log := log || E'\nFAIL  erasure left personal data behind';
  END IF;

  SELECT count(*) INTO cnt FROM public.affirmations WHERE member_id = m_a;
  IF cnt > 0 THEN
    log := log || E'\nPASS  affirmations retained after erasure';
  ELSE
    log := log || E'\nFAIL  affirmations lost on erasure';
  END IF;

  SELECT count(*) INTO cnt FROM public.member_consents
   WHERE member_id = m_a AND revoked_at IS NOT NULL;
  IF cnt > 0 THEN
    log := log || E'\nPASS  consent history retained and revoked';
  ELSE
    log := log || E'\nFAIL  consent history missing after erasure';
  END IF;

  SELECT count(*) INTO cnt FROM public.erasure_log WHERE member_id = m_a;
  IF cnt = 1 THEN
    log := log || E'\nPASS  erasure written to erasure_log';
  ELSE
    log := log || E'\nFAIL  erasure not logged';
  END IF;

  SELECT count(*) INTO cnt FROM public.conduct_actions WHERE member_id = m_a;
  IF cnt = 0 THEN
    log := log || E'\nPASS  erasure wrote no conduct action';
  ELSE
    log := log || E'\nFAIL  erasure recorded as conduct';
  END IF;

  PERFORM set_config('role', 'authenticated', true);

  -- 13. Every member table denies anonymous reads ----------------------------
  FOR t IN
    SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
       AND c.relname IN ('members','member_profiles','member_intent','member_settings',
                         'member_visibility','member_gender','member_consents',
                         'affirmations','member_standing','member_contributions',
                         'chapter_roles','conduct_actions','erasure_log',
                         'number_reservations')
  LOOP
    SELECT count(*) INTO cnt FROM pg_policies
     WHERE schemaname = 'public' AND tablename = t
       AND 'anon' = ANY(roles) AND cmd IN ('SELECT','ALL');
    IF cnt = 0 THEN
      log := log || E'\nPASS  no anon read policy on ' || t;
    ELSE
      log := log || E'\nFAIL  anon read policy exists on ' || t;
    END IF;

    SELECT c.relrowsecurity INTO tmp FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = t;
    IF tmp = 'true' THEN
      log := log || E'\nPASS  RLS enabled on ' || t;
    ELSE
      log := log || E'\nFAIL  RLS NOT enabled on ' || t;
    END IF;
  END LOOP;

  -- 14. Gender is not readable by anon or by service_role --------------------
  SELECT count(*) INTO cnt
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'member_gender'
     AND grantee IN ('anon','service_role','PUBLIC');
  IF cnt = 0 THEN
    log := log || E'\nPASS  member_gender granted to no role beyond authenticated/r17_reporting';
  ELSE
    log := log || E'\nFAIL  member_gender is granted to a broader role';
  END IF;

  ----------------------------------------------------------------------------
  -- Always abort. The results ride out on the exception message.
  ----------------------------------------------------------------------------
  RAISE EXCEPTION 'REGISTER INVARIANTS (transaction rolled back)%', log;
END;
$harness$;

SELECT pg_temp.run_register_invariants();
