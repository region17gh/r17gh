-- The router and the database should name the same screen the same thing.
-- account_state() returned 'activate', which collides in conversation with
-- registration activation (handle choice, /verify). The platform step is a
-- declaration, and it lives at /$locale/declare.
create or replace function public.account_state()
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_uid uuid; v_email text; m record; v_unclaimed boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('signed_in', false, 'route', 'sign-in');
  end if;

  v_email := lower(btrim(coalesce(auth.jwt() ->> 'email','')));
  select * into m from public.members where user_id = v_uid;

  if m.id is null then
    select exists (select 1 from public.members
                    where lower(email::text) = v_email and user_id is null) into v_unclaimed;
    return jsonb_build_object(
      'signed_in', true, 'member', false,
      'has_registration', v_unclaimed,
      'route', case when v_unclaimed then 'claim' else 'register' end);
  end if;

  return jsonb_build_object(
    'signed_in', true, 'member', true,
    'member_id', m.id, 'member_number', m.member_number,
    'display_name', coalesce(m.display_name, m.first_name),
    'status', m.status,
    'activated', public.member_is_activated(m.id),
    'onboarding', public.onboarding_status(m.id),
    'route', case
      when m.status in ('suspended','revoked','erased') then 'blocked'
      -- Registration is not finished: handle choice and email confirmation.
      when m.status = 'pending_verification' then 'verify'
      -- Registered, but the engine cannot see them yet.
      when not public.member_is_activated(m.id) then 'declare'
      else 'dashboard' end);
end;
$fn$;

comment on function public.account_state() is
  'One call on load. Routes to sign-in, claim, register, verify, declare, dashboard or blocked. verify is registration activation (handle, email); declare is platform activation (first declaration). They are different screens and now carry different names.';

create or replace function public.onboarding_status(p_member uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $fn$
  with m as (select coalesce(p_member, public.current_member_id()) as id),
  s as (
    select
      (select count(*) > 0 from public.members x where x.id = (select id from m)) as registered,
      (select count(*) > 0 from public.members x where x.id = (select id from m) and x.user_id is not null) as claimed,
      (select count(*) > 0 from public.members x where x.id = (select id from m) and x.status = 'active') as verified,
      (select count(*) > 0 from public.member_consents c where c.member_id = (select id from m)
        and c.consent_type = 'matching' and c.revoked_at is null) as consent,
      public.member_is_activated((select id from m)) as declaration,
      (select count(*) > 0 from public.member_profiles p where p.member_id = (select id from m)
        and (array_length(p.skills,1) > 0 or p.bio is not null)) as profile
  )
  select jsonb_build_object(
    'member_id', (select id from m),
    'registered', registered, 'claimed', claimed, 'verified', verified,
    'consent', consent, 'declaration', declaration, 'profile', profile,
    'activated', declaration,
    'complete', registered and claimed and verified and consent and declaration,
    'next_step', case
      when not registered then 'register'
      when not claimed then 'claim'
      when not verified then 'verify'
      when not declaration then 'declare'
      else 'done' end
  ) from s;
$fn$;
