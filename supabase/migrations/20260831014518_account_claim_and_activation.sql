-- The register and the platform were disconnected. A charter registrant exists
-- in members with user_id null, and every RLS policy resolves through
-- current_member_id(), which reads members.user_id = auth.uid(). Until the two
-- are linked a registered member can read nothing and declare nothing.
--
-- Registration already captures name, email, country, city, timezone,
-- connection types and region interests. Nothing here re-asks for any of it.

create or replace function public.claim_account()
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_uid uuid; v_email text; m record;
begin
  v_uid := auth.uid();
  v_email := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));

  if v_uid is null or v_email = '' then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  select * into m from public.members where user_id = v_uid;
  if m.id is not null then
    return jsonb_build_object('ok', true, 'already_claimed', true, 'member_id', m.id);
  end if;

  -- The verified address on the token is the only thing that proves ownership.
  select * into m from public.members
   where lower(email::text) = v_email and user_id is null
   order by created_at limit 1;

  if m.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no unclaimed registration for this address');
  end if;

  update public.members
     set user_id = v_uid,
         email_verified_at = coalesce(email_verified_at, now()),
         status = case when status = 'pending_verification' then 'active' else status end
   where id = m.id;

  -- Region interests were chosen at registration. Turn them into real follows
  -- rather than making the member pick their regions a second time.
  insert into public.subscriptions (member_id, subject_kind, subject_id)
  select m.id, 'place', r
  from unnest(m.region_interests) as r
  where exists (select 1 from public.places p where p.slug = r and p.is_published)
  on conflict do nothing;

  insert into public.member_onboarding (member_id, current_step)
  values (m.id, 'declaration')
  on conflict (member_id) do nothing;

  return jsonb_build_object('ok', true, 'already_claimed', false, 'member_id', m.id,
    'regions_followed', coalesce(array_length(m.region_interests, 1), 0));
end;
$fn$;

comment on function public.claim_account() is
  'Links a Supabase Auth user to the member row created at charter registration, matching on the verified address in the token. Idempotent. Converts region_interests into subscriptions so nobody picks their regions twice.';

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
      when not public.member_is_activated(m.id) then 'activate'
      else 'dashboard' end);
end;
$fn$;

comment on function public.account_state() is
  'One call on load. Tells the app whether to show sign-in, claim, activation or the dashboard, so routing is never guessed from partial state.';

drop function if exists public.complete_onboarding(text,public.connection_type,text,text[],text,text,text,text,text,text,text,integer,text);

create or replace function public.activate_membership(
  p_consents       text[],
  p_policy_version text,
  p_direction      text,
  p_pathway        text,
  p_place          text,
  p_headline       text,
  p_sector         text default null,
  p_capacity_note  text default null,
  p_months         integer default 18,
  p_visibility     text default 'members'
) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare v_member uuid; c text; v_has_matching boolean := false;
begin
  v_member := public.current_member_id();
  if v_member is null then
    raise exception 'no member record for this account; claim it first' using errcode = 'insufficient_privilege';
  end if;

  foreach c in array coalesce(p_consents,'{}') loop
    if c = 'matching' then v_has_matching := true; end if;
  end loop;
  if not v_has_matching then
    raise exception 'matching consent is required: a declaration exists to be routed'
      using errcode = 'check_violation';
  end if;

  foreach c in array coalesce(p_consents,'{}') loop
    insert into public.member_consents (member_id, consent_type, policy_version, mechanism)
    values (v_member, c::public.consent_type, p_policy_version, 'activation');
  end loop;

  insert into public.declarations
    (member_id, direction, pathway_slug, sector_slug, place_slug, headline, capacity_note,
     available_until, visibility)
  values
    (v_member, p_direction, p_pathway, p_sector, p_place, p_headline, p_capacity_note,
     (current_date + (greatest(1, least(coalesce(p_months,18), 24)) || ' months')::interval)::date,
     coalesce(p_visibility,'members'));

  insert into public.subscriptions (member_id, subject_kind, subject_id)
  values (v_member, 'place', p_place) on conflict do nothing;

  insert into public.member_onboarding (member_id, current_step, completed_at)
  values (v_member, 'declaration', now())
  on conflict (member_id) do update set current_step = 'declaration', completed_at = now(), updated_at = now();

  insert into public.notifications (member_id, kind, subject_kind, subject_id, title, body, url_path)
  select v_member, 'account', 'member', v_member::text,
         'You are in',
         'You declared: ' || p_headline || '. We will tell you when ' || p.name || ' posts something that fits.',
         'dashboard'
  from public.places p where p.slug = p_place;

  return public.onboarding_status(v_member);
end;
$fn$;

comment on function public.activate_membership(text[],text,text,text,text,text,text,text,integer,text) is
  'Post-sign-in. Takes only what charter registration did not already collect: a first declaration and consent to be matched on it.';

create or replace function public.onboarding_status(p_member uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $fn$
  with m as (select coalesce(p_member, public.current_member_id()) as id),
  s as (
    select
      (select count(*) > 0 from public.members x where x.id = (select id from m)) as registered,
      (select count(*) > 0 from public.members x where x.id = (select id from m) and x.user_id is not null) as claimed,
      (select count(*) > 0 from public.member_consents c where c.member_id = (select id from m)
        and c.consent_type = 'matching' and c.revoked_at is null) as consent,
      public.member_is_activated((select id from m)) as declaration,
      (select count(*) > 0 from public.member_profiles p where p.member_id = (select id from m)
        and (array_length(p.skills,1) > 0 or p.bio is not null)) as profile
  )
  select jsonb_build_object(
    'member_id', (select id from m),
    'registered', registered, 'claimed', claimed, 'consent', consent,
    'declaration', declaration, 'profile', profile,
    'activated', declaration,
    'complete', registered and claimed and consent and declaration,
    'next_step', case
      when not registered then 'register'
      when not claimed then 'claim'
      when not declaration then 'activate'
      else 'done' end
  ) from s;
$fn$;

revoke all on function public.claim_account() from public, anon;
grant execute on function public.claim_account() to authenticated, service_role;
revoke all on function public.account_state() from public;
grant execute on function public.account_state() to anon, authenticated, service_role;
revoke all on function public.activate_membership(text[],text,text,text,text,text,text,text,integer,text) from public, anon;
grant execute on function public.activate_membership(text[],text,text,text,text,text,text,text,integer,text) to authenticated, service_role;
