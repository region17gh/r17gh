-- TRUNCATE is not filtered by row-level security. Postgres checks the privilege and
-- empties the table. Every table in public currently grants it to anon and
-- authenticated, which is the default Supabase grant nobody tightened.
-- Nothing in the application needs it. Per D-050, a privilege that is not needed
-- is not granted, and the absence of it is the control.
-- Deliberately narrow: INSERT, UPDATE and DELETE are left alone because RLS is
-- genuinely gating those, and revoking them blind risks breaking the join flow.

revoke truncate on all tables in schema public from anon, authenticated;
revoke references on all tables in schema public from anon, authenticated;

alter default privileges in schema public
  revoke truncate on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;
