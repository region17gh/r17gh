-- O-006. Three gaps in erasure, all found 27 Aug 2026.
--
-- 1. pseudonymize_member() nulls members.user_id, which is the ONLY pointer to the
--    auth.users row holding the member's email. After it ran, that row could never
--    be found again: a permanent orphaned copy of the email with no way to link it.
--    The auth user id is now captured into erasure_log before it is destroyed, and
--    the erasure is not complete until auth_deleted_at is stamped.
-- 2. Free text survived erasure on member_contributions, member_standing and
--    conduct_actions, any of which can name the person.
-- 3. Running it twice re-logged and re-released. Now idempotent.

alter table public.erasure_log
  add column if not exists auth_user_id    uuid,
  add column if not exists auth_deleted_at timestamptz;

comment on column public.erasure_log.auth_user_id is
  'The auth.users id that still holds this member''s email. Erasure is INCOMPLETE while this is set and auth_deleted_at is null. Cleared when the auth user is actually deleted.';

drop function if exists public.pseudonymize_member(uuid, text, uuid);

create or replace function public.pseudonymize_member(
  target uuid,
  reason text default 'member request',
  actor  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
DECLARE
  old_handle citext;
  old_user   uuid;
  already    timestamptz;
BEGIN
  SELECT m.handle, m.user_id, m.pseudonymized_at
    INTO old_handle, old_user, already
    FROM public.members m WHERE m.id = target FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such member.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Idempotent. Re-running returns the outstanding auth id rather than re-logging.
  IF already IS NOT NULL THEN
    RETURN (SELECT e.auth_user_id FROM public.erasure_log e
             WHERE e.member_id = target AND e.auth_deleted_at IS NULL
             ORDER BY e.erased_at DESC LIMIT 1);
  END IF;

  IF old_handle IS NOT NULL THEN
    INSERT INTO public.reserved_handles (handle, reason)
    VALUES (old_handle, 'released') ON CONFLICT (handle) DO NOTHING;
  END IF;

  UPDATE public.members SET
    user_id = NULL, handle = NULL,
    first_name = NULL, last_name = NULL, display_name = NULL,
    email = NULL, email_verified_at = NULL,
    birth_month = NULL, birth_year = NULL,
    country = NULL, city = NULL, subdivision = NULL,
    timezone = 'UTC',
    connection_types = '{}', primary_connection = NULL, region_interests = '{}',
    status = 'erased', pseudonymized_at = now()
  WHERE id = target;

  DELETE FROM public.member_profiles   WHERE member_id = target;
  DELETE FROM public.member_intent     WHERE member_id = target;
  DELETE FROM public.member_settings   WHERE member_id = target;
  DELETE FROM public.member_visibility WHERE member_id = target;
  DELETE FROM public.member_gender     WHERE member_id = target;

  -- Free text that outlives the member record and can name them.
  -- Rows are kept so aggregate counts and standing integrity survive; only the
  -- identifying prose goes.
  UPDATE public.member_contributions SET description = NULL WHERE member_id = target;
  UPDATE public.member_standing      SET evidence    = NULL WHERE member_id = target;

  -- conduct_actions.actor_note is internal staff commentary with no safety value
  -- once the member is gone. conduct_actions.reason and level are DELIBERATELY kept:
  -- they are a safety record, and whether that survives an erasure request is a
  -- legitimate-interest question for Ghanaian counsel, not one to settle in a migration.
  -- Carried into the O-013 brief.
  UPDATE public.conduct_actions SET actor_note = NULL WHERE member_id = target;

  UPDATE public.member_consents SET revoked_at = now()
   WHERE member_id = target AND revoked_at IS NULL;

  INSERT INTO public.erasure_log (member_id, reason, actor_id, auth_user_id)
  VALUES (target, reason, actor, old_user);

  RETURN old_user;
END; $function$;

comment on function public.pseudonymize_member(uuid, text, uuid) is
  'Pseudonymizes a member and returns the auth.users id that the caller MUST still delete. Erasure is not complete until that auth user is gone and mark_auth_user_deleted() has been called. Idempotent.';

revoke all on function public.pseudonymize_member(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.pseudonymize_member(uuid, text, uuid) to service_role;

create or replace function public.mark_auth_user_deleted(p_member uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'mark_auth_user_deleted is restricted to service_role.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.erasure_log
     SET auth_deleted_at = now(), auth_user_id = NULL
   WHERE member_id = p_member AND auth_deleted_at IS NULL;
END; $function$;

revoke all on function public.mark_auth_user_deleted(uuid) from public, anon, authenticated;
grant execute on function public.mark_auth_user_deleted(uuid) to service_role;

-- Incomplete erasures are visible rather than silent. A row here is a member who
-- asked to be forgotten and whose email is still sitting in auth.users.
create or replace view public.incomplete_erasures
with (security_invoker = true) as
  select e.member_id, e.erased_at, e.auth_user_id, e.reason
    from public.erasure_log e
   where e.auth_user_id is not null and e.auth_deleted_at is null
   order by e.erased_at;

comment on view public.incomplete_erasures is
  'Erasure requests where the auth.users record still holds the member''s email. Should always be empty. Anything lingering here is an unfulfilled deletion right under Act 843 and GDPR.';
