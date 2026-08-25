-- ============================================================
-- Region 17 Ghana — the handle-retirement write runs as its own author
--
-- enforce_member_rules() retires a member's old handle into reserved_handles
-- the first time they change it. That INSERT ran with the caller's own
-- privileges: with no SECURITY DEFINER, a trigger fired by an authenticated
-- member's own UPDATE executes as authenticated. authenticated holds SELECT
-- only on reserved_handles -- INSERT was never granted, and RLS carries no
-- INSERT policy either. The result: the one handle change every member is
-- promised has been failing with an RLS refusal for every real member who
-- has ever tried it, since pass 1.
--
-- This was never caught because every prior harness run connected as an
-- elevated/BYPASSRLS role, which sails past RLS regardless of the trigger's
-- own rights. It surfaced only once the harness was corrected to run its
-- assertions as authenticated for real.
--
-- Fix: make the trigger SECURITY DEFINER, so its own write to
-- reserved_handles runs with the function owner's privileges rather than the
-- caller's. This is safe because the function already pins
-- `search_path = public, extensions`, which is what SECURITY DEFINER needs
-- to avoid a search_path hijack. Nothing else about the function changes --
-- this is the current body verbatim, plus SECURITY DEFINER on the signature.
--
-- The other two triggers on members were checked and are not affected:
-- touch_updated_at() only assigns NEW.updated_at, no cross-table access.
-- check_region_slugs() only SELECTs ghana_regions, which grants SELECT to
-- authenticated with a matching RLS policy.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_member_rules()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  earliest date;
  erasing boolean := false;
BEGIN
  NEW.class_year := EXTRACT(YEAR FROM NEW.joined_at)::integer;

  IF TG_OP = 'UPDATE' THEN
    erasing := NEW.pseudonymized_at IS NOT NULL AND OLD.pseudonymized_at IS NULL;
  END IF;

  IF NEW.birth_year IS NOT NULL AND NEW.birth_month IS NOT NULL THEN
    earliest := (make_date(NEW.birth_year, NEW.birth_month, 1) + interval '1 month - 1 day')::date;
    IF earliest > (current_date - interval '18 years')::date THEN
      RAISE EXCEPTION 'Members must be 18 or older.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.handle IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.reserved_handles r WHERE r.handle = NEW.handle) THEN
      RAISE EXCEPTION 'That handle is reserved.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.founding_member := NEW.joined_at <= (
      (SELECT value #>> '{}' FROM public.app_config WHERE key = 'founding_member_cutoff')::timestamptz);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.founding_member := OLD.founding_member;

    IF erasing THEN
      -- erasure clears the handle; pseudonymize_member retires it separately
      NULL;
    ELSIF NEW.handle IS DISTINCT FROM OLD.handle THEN
      IF OLD.handle IS NOT NULL AND OLD.handle_changed_at IS NOT NULL THEN
        RAISE EXCEPTION 'A handle may be changed once only.' USING ERRCODE = 'check_violation';
      END IF;
      IF OLD.handle IS NOT NULL THEN
        NEW.handle_changed_at := now();
        INSERT INTO public.reserved_handles (handle, reason)
        VALUES (OLD.handle, 'released') ON CONFLICT (handle) DO NOTHING;
      END IF;
    ELSE
      NEW.handle_changed_at := OLD.handle_changed_at;
    END IF;

    IF NEW.member_number IS DISTINCT FROM OLD.member_number
       OR NEW.credential_id IS DISTINCT FROM OLD.credential_id THEN
      RAISE EXCEPTION 'Member number and credential ID are permanent.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

COMMENT ON FUNCTION public.enforce_member_rules() IS
'BEFORE INSERT OR UPDATE trigger on members. SECURITY DEFINER so its own INSERT into reserved_handles (retiring a released handle) runs with the function owner''s privileges rather than the triggering row''s caller -- authenticated holds only SELECT on reserved_handles. search_path is pinned to public, extensions, which is what makes SECURITY DEFINER safe here. Read the full body before editing.';
