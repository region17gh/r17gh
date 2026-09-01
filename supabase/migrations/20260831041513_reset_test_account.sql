-- Wipes what a test account did so onboarding can be walked again from the top,
-- without touching the account itself. Test range only, so it can never be
-- pointed at a real member.
create or replace function public.reset_test_account(p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare m record; v jsonb;
begin
  select * into m from public.members where lower(email::text) = lower(btrim(p_email));
  if m.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no member with that address');
  end if;
  if m.member_number < 999000 then
    raise exception 'refusing: % is a real member number, not a test account', m.member_number
      using errcode = 'check_violation';
  end if;

  v := jsonb_build_object(
    'declarations', (select count(*) from public.declarations where member_id = m.id),
    'subscriptions', (select count(*) from public.subscriptions where member_id = m.id),
    'notifications', (select count(*) from public.notifications where member_id = m.id));

  delete from public.notification_deliveries where member_id = m.id;
  delete from public.notifications where member_id = m.id;
  delete from public.matches where member_id = m.id;
  delete from public.declarations where member_id = m.id;
  delete from public.subscriptions where member_id = m.id;
  delete from public.member_consents where member_id = m.id;
  delete from public.member_onboarding where member_id = m.id;
  delete from public.offering_registrations where member_id = m.id;

  -- Region interests go back the way registration left them, so claim_account
  -- re-creates the follows exactly as a new member would experience it.
  update public.members
     set region_interests = array['volta','greater-accra'],
         status = case when user_id is null then 'pending_verification' else 'active' end
   where id = m.id;

  return jsonb_build_object('ok', true, 'member_id', m.id, 'cleared', v,
    'note', 'Sign in and activate again. The account, its number and its credential are untouched.');
end;
$fn$;

revoke all on function public.reset_test_account(text) from public, anon, authenticated;
grant execute on function public.reset_test_account(text) to service_role;

comment on function public.reset_test_account(text) is
  'Clears declarations, follows, matches, notifications and consents for a test-range account so onboarding can be walked again. Refuses on any member number below 999000.';
