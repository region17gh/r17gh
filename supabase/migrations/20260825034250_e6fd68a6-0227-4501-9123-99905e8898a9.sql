REVOKE ALL ON FUNCTION public.current_member_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_member_id() TO authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION citext SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;