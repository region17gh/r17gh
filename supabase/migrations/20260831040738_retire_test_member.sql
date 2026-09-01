-- Pre-launch only. A member who has done anything cannot be deleted:
-- activity_events.actor_member_id is ON DELETE RESTRICT and the table is
-- append-only, which is the retained-attribution rule working as intended.
-- So a test account is retired by moving it into the test number range and
-- pseudonymizing it, then rewinding the real sequence so the first genuine
-- member is number 1.
create or replace function public.retire_test_member(p_email text, p_confirm boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  m record; v_new_number integer; v_auth uuid; v_live integer;
begin
  select count(*) into v_live from public.members where status <> 'erased';
  if v_live > 3 then
    raise exception 'refusing: % live members. This is a pre-launch tool only.', v_live
      using errcode = 'check_violation';
  end if;

  select * into m from public.members where lower(email::text) = lower(btrim(p_email));
  if m.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no member with that address');
  end if;

  if not p_confirm then
    return jsonb_build_object(
      'ok', false,
      'reason', 'dry run',
      'would_retire', jsonb_build_object(
        'member_id', m.id, 'member_number', m.member_number,
        'credential_id', m.credential_id, 'display_name', m.display_name,
        'declarations', (select count(*) from public.declarations where member_id = m.id),
        'subscriptions', (select count(*) from public.subscriptions where member_id = m.id),
        'activity_events', (select count(*) from public.activity_events where actor_member_id = m.id)),
      'next_real_number_after', 1,
      'note', 'Re-run with p_confirm => true to proceed.');
  end if;

  -- Move it out of the real range. The row survives, so append-only activity
  -- and every foreign key still resolve.
  v_new_number := nextval('public.test_member_number_seq')::integer;
  update public.members
     set member_number = v_new_number,
         credential_id = public.credential_id(extract(year from now())::int, v_new_number),
         founding_member = false
   where id = m.id;

  -- Strip the identity through the proper erasure path, not a delete.
  v_auth := public.pseudonymize_member(m.id, 'pre-launch test account retired', null);

  -- Free any reservation the registration flow made, then rewind so the first
  -- genuine member is number 1.
  delete from public.number_reservations where member_number = m.member_number;
  perform setval('public.member_number_seq', 1, false);

  return jsonb_build_object(
    'ok', true,
    'member_id', m.id,
    'old_number', m.member_number,
    'new_number', v_new_number,
    'auth_user_id', v_auth,
    'next_real_number', 1,
    'next_step', 'Delete the auth user with that id from Authentication > Users, so the address can register again cleanly.');
end;
$fn$;

comment on function public.retire_test_member(text,boolean) is
  'Pre-launch only, refuses above three live members. Renumbers a test account into the test range, pseudonymizes it, and rewinds member_number_seq so the first real member is 1. Never deletes: activity attribution is retained by design.';

revoke all on function public.retire_test_member(text,boolean) from public, anon, authenticated;
grant execute on function public.retire_test_member(text,boolean) to service_role;
