-- ============================================================
-- Region 17 Ghana — gender record, held apart, write-only to the member
-- ============================================================

CREATE TYPE public.gender_identity AS ENUM (
  'prefer_not_to_say','woman','man','non_binary','self_described'
);

-- A named role that exists solely to read the gender record for reporting.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'r17_reporting') THEN
    CREATE ROLE r17_reporting NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO r17_reporting;

CREATE TABLE public.member_gender (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  gender public.gender_identity NOT NULL DEFAULT 'prefer_not_to_say',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER member_gender_touch BEFORE UPDATE ON public.member_gender
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Grants: the member writes, never reads. The reporting role reads, never writes.
-- service_role deliberately gets no SELECT: it maintains the row, it does not read it.
GRANT INSERT, UPDATE ON public.member_gender TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.member_gender TO service_role;
GRANT SELECT ON public.member_gender TO r17_reporting;

ALTER TABLE public.member_gender ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gender declare own" ON public.member_gender
  FOR INSERT TO authenticated WITH CHECK (member_id = public.current_member_id());
CREATE POLICY "gender amend own" ON public.member_gender
  FOR UPDATE TO authenticated USING (member_id = public.current_member_id()) WITH CHECK (member_id = public.current_member_id());
CREATE POLICY "gender reporting read" ON public.member_gender
  FOR SELECT TO r17_reporting USING (true);
-- no SELECT policy for authenticated, anon or service_role.

-- ---------- reporting layer, with small-cell suppression ----------
CREATE OR REPLACE FUNCTION public.report_gender_distribution(min_cell integer DEFAULT 10)
RETURNS TABLE (gender public.gender_identity, member_count integer, suppressed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.gender,
         CASE WHEN count(*) < min_cell THEN NULL ELSE count(*)::integer END,
         count(*) < min_cell
    FROM public.member_gender g
    JOIN public.members m ON m.id = g.member_id
   WHERE m.pseudonymized_at IS NULL
   GROUP BY g.gender
   ORDER BY g.gender;
$$;

REVOKE ALL ON FUNCTION public.report_gender_distribution(integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_gender_distribution(integer) TO r17_reporting;

-- ---------- erasure keeps pace ----------
CREATE OR REPLACE FUNCTION public.pseudonymize_member(target uuid, reason text DEFAULT 'member request')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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
    status = 'revoked',
    pseudonymized_at = now()
  WHERE id = target;

  DELETE FROM public.member_profiles WHERE member_id = target;
  DELETE FROM public.member_intent WHERE member_id = target;
  DELETE FROM public.member_settings WHERE member_id = target;
  DELETE FROM public.member_visibility WHERE member_id = target;
  DELETE FROM public.member_gender WHERE member_id = target;

  UPDATE public.member_consents SET revoked_at = now()
   WHERE member_id = target AND revoked_at IS NULL;

  INSERT INTO public.conduct_actions (member_id, level, reason, conduct_version)
  VALUES (target, 'note', 'Record pseudonymised: ' || reason,
          COALESCE((SELECT value #>> '{}' FROM public.app_config WHERE key = 'conduct_version'), '1.0'));
END; $$;

REVOKE ALL ON FUNCTION public.pseudonymize_member(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pseudonymize_member(uuid, text) TO service_role;