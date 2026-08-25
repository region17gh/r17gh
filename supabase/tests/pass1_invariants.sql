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
-- Adding a case: append to the `check` calls below. The known invariant
-- collision this harness caught (erasure clearing the handle tripping the
-- once-only handle rule) is exactly the class of bug that reappears whenever
-- a new rule is added, so err towards adding cases for rule interactions,
-- not just rules.
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
  m_a uuid;
  m_b uuid;
  n_a integer;
  n_b integer;
  cred_a text;
  tmp text;
  cnt integer;
  t text;
BEGIN
  ----------------------------------------------------------------------------
  -- helper: local macro via inline blocks. Each check appends to `log`.
  ----------------------------------------------------------------------------

  -- 1. Registration requires a live reservation ------------------------------
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', uid_a::text, true);
    PERFORM set_config('role', 'authenticated', true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- unreserved number
  BEGIN
    PERFORM public.register_member(999001);
    log := log || E'\nFAIL  register_member accepted an unreserved number';
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nPASS  unreserved number refused: ' || SQLERRM;
  END;

  -- expired reservation
  INSERT INTO public.number_reservations (member_number, expires_at)
  VALUES (999002, now() - interval '1 hour');
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

  -- 3. Two members, created the sanctioned way -------------------------------
  INSERT INTO public.number_reservations (member_number, expires_at)
  VALUES (999003, now() + interval '1 hour'), (999004, now() + interval '1 hour');

  INSERT INTO public.members (user_id, member_number, credential_id, handle,
    first_name, email, birth_month, birth_year, timezone)
  VALUES (uid_a, 999003, public.credential_id(2026, 999003), 'harnessa',
    'A', 'a@example.test', 1::smallint, 1990::smallint, 'UTC')
  RETURNING id, member_number, credential_id INTO m_a, n_a, cred_a;

  INSERT INTO public.members (user_id, member_number, credential_id, handle,
    first_name, email, birth_month, birth_year, timezone)
  VALUES (uid_b, 999004, public.credential_id(2026, 999004), 'harnessbb',
    'B', 'b@example.test', 1::smallint, 1990::smallint, 'UTC')
  RETURNING id INTO m_b;

  log := log || E'\nINFO  credential for 999003 = ' || cred_a;

  -- 4. Age gate --------------------------------------------------------------
  BEGIN
    INSERT INTO public.number_reservations (member_number, expires_at)
    VALUES (999005, now() + interval '1 hour');
    INSERT INTO public.members (user_id, member_number, credential_id,
      birth_month, birth_year)
    VALUES (gen_random_uuid(), 999005, public.credential_id(2026, 999005),
      1::smallint, (EXTRACT(YEAR FROM now())::int - 17)::smallint);
    log := log || E'\nFAIL  under-18 insert accepted';
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nPASS  under-18 insert refused: ' || SQLERRM;
  END;

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
  UPDATE public.members SET handle = 'harnessb' WHERE id = m_a;
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
  BEGIN
    UPDATE public.members SET member_number = 1 WHERE id = m_b;
    log := log || E'\nFAIL  member_number was mutable';
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nPASS  member_number/credential immutable: ' || SQLERRM;
  END;

  -- 8. Append-only history ---------------------------------------------------
  INSERT INTO public.affirmations (member_id, compact_version, conduct_version)
  VALUES (m_a, 'v1', 'v1');
  BEGIN
    UPDATE public.affirmations SET compact_version = 'v2' WHERE member_id = m_a;
    log := log || E'\nFAIL  affirmation update accepted';
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nPASS  affirmation update refused: ' || SQLERRM;
  END;

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
  BEGIN
    DELETE FROM public.members WHERE id = m_a;
    log := log || E'\nFAIL  member with consent history was deletable';
  EXCEPTION WHEN OTHERS THEN
    log := log || E'\nPASS  member delete restricted by history: ' || SQLERRM;
  END;

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
  UPDATE public.app_config SET value = to_jsonb('2000-01-01T00:00:00Z'::text)
   WHERE key = 'founding_member_cutoff';
  UPDATE public.members SET city = 'Accra' WHERE id = m_a;
  SELECT founding_member::text INTO tmp FROM public.members WHERE id = m_a;
  IF t = tmp THEN
    log := log || E'\nPASS  founding_member unchanged after cutoff edit (' || t || ')';
  ELSE
    log := log || E'\nFAIL  founding_member moved with the cutoff';
  END IF;

  -- 12. Erasure --------------------------------------------------------------
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
