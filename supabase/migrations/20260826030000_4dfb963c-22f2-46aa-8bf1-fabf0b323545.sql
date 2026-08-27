-- ============================================================
-- Region 17 Ghana — reserved test range for member numbers
-- ============================================================
-- Registering to exercise the join flow currently costs a real founding
-- member number permanently -- register_member() has no other source of
-- numbers, and every reservation it claims comes from member_number_seq,
-- the same sequence real members draw from. That was fine while the
-- register carried no real rows. It carries none right now either (it was
-- just reset), which is exactly why this has to land before the register
-- fills: it is much cheaper to reserve a range no one has touched yet than
-- to explain later why founding numbers have gaps.
--
-- This is pre-launch scaffolding, not a permanent feature. It is scoped to
-- be removed in one migration once the harness (or another mechanism) no
-- longer needs to register test members against a live database. A future
-- removal migration needs to:
--   1. DROP FUNCTION public.reserve_test_member_number();
--   2. DROP SEQUENCE public.test_member_number_seq;
--   3. Decide what becomes of member_number_seq's MAXVALUE (raise it,
--      or drop it with ALTER SEQUENCE ... NO MAXVALUE) once 999000+ is no
--      longer off-limits.
--   4. Remove the `member_number < 999000` filter this migration adds to
--      report_gender_distribution(), and audit any report or count added
--      after this migration for the same filter -- this one is the only
--      one that exists today.
--   5. Delete (or pseudonymize) any real rows left in public.members with
--      member_number >= 999000. This migration only stops new test rows
--      from being counted; it does not expire old ones.
--
-- ---------- the range ----------
-- 999000 and above is reserved and never issued to a real member.
-- 999001-999006 is already spoken for: supabase/tests/pass1_invariants.sql
-- inserts number_reservations rows in that span directly (bypassing both
-- functions below) and always rolls its transaction back, so those numbers
-- never persist. A persistent test registration -- someone actually running
-- through /join against this range and leaving a row behind -- must not
-- land on a number the next harness run is about to claim. This migration
-- gives persistent test registrations their own sub-range, starting well
-- clear of the harness's: 999100-999999.
--
-- ---------- reserve_member_number() stays branch-free ----------
-- Rather than teach the production path a new `if test then` branch that
-- could misfire, member_number_seq itself is capped below the test range.
-- nextval() on a sequence at MAXVALUE raises rather than returning a value
-- past it, so this is a guarantee enforced by Postgres, not by a condition
-- someone could get wrong or skip. reserve_member_number()'s body is
-- unchanged.
ALTER SEQUENCE public.member_number_seq MAXVALUE 998999;

-- ---------- the test range's own sequence ----------
CREATE SEQUENCE public.test_member_number_seq
  AS integer START WITH 999100 MINVALUE 999100 MAXVALUE 999999 NO CYCLE;

GRANT USAGE ON SEQUENCE public.test_member_number_seq TO service_role;

-- ---------- reserve_test_member_number(): a separate function, not a flag ----------
-- Mirrors reserve_member_number() exactly except for which sequence it
-- draws from. A flag on reserve_member_number() would leave a permanent
-- scar in the security-critical path once this scaffolding comes out; a
-- separate function is deleted cleanly instead, per the removal note above.
-- service_role only, same as reserve_member_number() -- nothing reachable
-- from the browser can call either.
CREATE OR REPLACE FUNCTION public.reserve_test_member_number()
RETURNS TABLE (member_number integer, credential_id text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  n integer;
  ttl integer := COALESCE((SELECT (value #>> '{}')::int FROM public.app_config WHERE key = 'number_reservation_ttl_minutes'), 60);
  exp timestamptz;
BEGIN
  n := nextval('public.test_member_number_seq')::integer;
  exp := now() + make_interval(mins => ttl);
  INSERT INTO public.number_reservations (member_number, expires_at) VALUES (n, exp);
  RETURN QUERY SELECT n, public.credential_id(EXTRACT(YEAR FROM now())::int, n), exp;
END; $$;

REVOKE ALL ON FUNCTION public.reserve_test_member_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_test_member_number() TO service_role;

COMMENT ON FUNCTION public.reserve_test_member_number() IS
'Pre-launch scaffolding, removable in one migration -- see the header of 20260826030000. Reserves from test_member_number_seq (999100-999999) so the join flow can be exercised without spending a real founding member number. service_role only.';

-- ---------- test rows never enter membership figures ----------
-- member_number >= 999000 is itself the marker -- no separate column to add
-- or later drop. report_gender_distribution() is the one reporting function
-- that exists today; it gains the same filter it already applies for
-- pseudonymized rows.
CREATE OR REPLACE FUNCTION public.report_gender_distribution(min_cell integer DEFAULT 10)
RETURNS TABLE (gender public.gender_identity, member_count integer, suppressed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT g.gender,
         CASE WHEN count(*) < min_cell THEN NULL ELSE count(*)::integer END,
         count(*) < min_cell
    FROM public.member_gender g
    JOIN public.members m ON m.id = g.member_id
   WHERE m.pseudonymized_at IS NULL
     AND m.member_number < 999000
   GROUP BY g.gender
   ORDER BY g.gender;
$$;
