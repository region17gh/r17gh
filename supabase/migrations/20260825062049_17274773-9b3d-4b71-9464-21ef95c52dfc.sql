-- ============ 1. erased status + erasure log ============
ALTER TYPE public.member_status ADD VALUE IF NOT EXISTS 'erased';

CREATE TABLE public.erasure_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  erased_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  actor_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.erasure_log TO service_role;
ALTER TABLE public.erasure_log ENABLE ROW LEVEL SECURITY;
-- deny-all by design: erasure records are handled only by trusted server code

-- ============ 2. append-only history survives member deletion ============
ALTER TABLE public.member_consents DROP CONSTRAINT member_consents_member_id_fkey;
ALTER TABLE public.member_consents
  ADD CONSTRAINT member_consents_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE RESTRICT;

ALTER TABLE public.affirmations DROP CONSTRAINT affirmations_member_id_fkey;
ALTER TABLE public.affirmations
  ADD CONSTRAINT affirmations_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE RESTRICT;

-- ============ 3. gender: member may read and correct their own record ============
GRANT SELECT ON public.member_gender TO authenticated;
CREATE POLICY "gender read own" ON public.member_gender
  FOR SELECT TO authenticated USING (member_id = public.current_member_id());

-- ============ 4. founding member frozen at insert ============
ALTER TABLE public.members ADD COLUMN founding_member boolean NOT NULL DEFAULT false;

UPDATE public.members m SET founding_member =
  (m.joined_at <= ((SELECT value #>> '{}' FROM public.app_config WHERE key = 'founding_member_cutoff')::timestamptz));

CREATE OR REPLACE FUNCTION public.is_founding_member(m public.members)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT m.founding_member;
$$;

-- ============ 5. member rules: search_path, released handles, frozen founding flag ============
CREATE OR REPLACE FUNCTION public.enforce_member_rules()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE
  earliest date;
BEGIN
  NEW.class_year := EXTRACT(YEAR FROM NEW.joined_at)::integer;

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
    -- founding status is decided once, at join, and never recomputed
    NEW.founding_member := NEW.joined_at <= (
      (SELECT value #>> '{}' FROM public.app_config WHERE key = 'founding_member_cutoff')::timestamptz);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.founding_member := OLD.founding_member;

    IF NEW.handle IS DISTINCT FROM OLD.handle THEN
      IF OLD.handle IS NOT NULL AND OLD.handle_changed_at IS NOT NULL THEN
        RAISE EXCEPTION 'A handle may be changed once only.' USING ERRCODE = 'check_violation';
      END IF;
      IF OLD.handle IS NOT NULL THEN
        NEW.handle_changed_at := now();
        -- a released handle is retired, never reissued
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

ALTER FUNCTION public.check_region_slugs() SET search_path = public, extensions;
ALTER FUNCTION public.current_member_id() SET search_path = public, extensions;
ALTER FUNCTION public.consents_revoke_only() SET search_path = public, extensions;
ALTER FUNCTION public.block_mutation() SET search_path = public, extensions;
ALTER FUNCTION public.touch_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.reserve_member_number() SET search_path = public, extensions;
ALTER FUNCTION public.report_gender_distribution(integer) SET search_path = public, extensions;
ALTER FUNCTION public.credential_id(integer, integer) SET search_path = public, extensions;
ALTER FUNCTION public.damm_digit(text) SET search_path = public, extensions;

-- ============ 6. registration goes through a trusted routine ============
REVOKE INSERT ON public.members FROM authenticated;
DROP POLICY IF EXISTS "members insert own" ON public.members;

CREATE OR REPLACE FUNCTION public.register_member(
  p_member_number integer,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_display_name text DEFAULT NULL,
  p_handle text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_birth_month smallint DEFAULT NULL,
  p_birth_year smallint DEFAULT NULL,
  p_country char(2) DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_timezone text DEFAULT 'UTC',
  p_connection_types public.connection_type[] DEFAULT '{}',
  p_primary_connection public.connection_type DEFAULT NULL,
  p_region_interests text[] DEFAULT '{}'
)
RETURNS TABLE(member_id uuid, member_number integer, credential_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
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
END; $$;

REVOKE ALL ON FUNCTION public.register_member(integer, text, text, text, text, text, smallint, smallint, char(2), text, text, public.connection_type[], public.connection_type, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_member(integer, text, text, text, text, text, smallint, smallint, char(2), text, text, public.connection_type[], public.connection_type, text[]) TO authenticated, service_role;

-- ============ 7. erasure: distinct status, own log, handle retired ============
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

REVOKE ALL ON FUNCTION public.pseudonymize_member(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pseudonymize_member(uuid, text, uuid) TO service_role;
DROP FUNCTION IF EXISTS public.pseudonymize_member(uuid, text);