create or replace function public.complete_onboarding(
  p_display_name   text,
  p_connection     public.connection_type,
  p_timezone       text,
  p_consents       text[],
  p_policy_version text,
  p_direction      text,
  p_pathway        text,
  p_place          text,
  p_headline       text,
  p_sector         text default null,
  p_capacity_note  text default null,
  p_months         integer default 12,
  p_visibility     text default 'members'
) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare v_member uuid; v_decl uuid; c text; v_has_matching boolean := false;
begin
  v_member := public.current_member_id();
  if v_member is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  if p_display_name is null or length(btrim(p_display_name)) < 2 then
    raise exception 'a display name is required' using errcode = 'check_violation';
  end if;

  foreach c in array coalesce(p_consents, '{}') loop
    if c = 'matching' then v_has_matching := true; end if;
  end loop;
  if not v_has_matching then
    raise exception 'matching consent is required: a declaration exists to be routed'
      using errcode = 'check_violation';
  end if;

  update public.members
     set display_name = btrim(p_display_name),
         primary_connection = p_connection,
         timezone = coalesce(p_timezone, 'UTC')
   where id = v_member;

  foreach c in array coalesce(p_consents, '{}') loop
    insert into public.member_consents (member_id, consent_type, policy_version, mechanism)
    values (v_member, c::public.consent_type, p_policy_version, 'onboarding');
  end loop;

  insert into public.declarations
    (member_id, direction, pathway_slug, sector_slug, place_slug, headline, capacity_note,
     available_until, visibility)
  values
    (v_member, p_direction, p_pathway, p_sector, p_place, p_headline, p_capacity_note,
     (current_date + (greatest(1, least(coalesce(p_months,12), 24)) || ' months')::interval)::date,
     coalesce(p_visibility,'members'))
  returning id into v_decl;

  insert into public.subscriptions (member_id, subject_kind, subject_id)
  values (v_member, 'place', p_place)
  on conflict do nothing;

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

create or replace function public.onboarding_status(p_member uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $fn$
  with m as (select coalesce(p_member, public.current_member_id()) as id),
  s as (
    select
      (select count(*) > 0 from public.members x where x.id = (select id from m)) as account,
      (select count(*) > 0 from public.members x where x.id = (select id from m)
        and x.display_name is not null and x.primary_connection is not null) as identity,
      (select count(*) > 0 from public.member_consents c where c.member_id = (select id from m)
        and c.consent_type = 'matching' and c.revoked_at is null) as consent,
      public.member_is_activated((select id from m)) as declaration,
      (select count(*) > 0 from public.member_profiles p where p.member_id = (select id from m)
        and (array_length(p.skills,1) > 0 or p.bio is not null)) as profile
  )
  select jsonb_build_object(
    'member_id', (select id from m),
    'account', account, 'identity', identity, 'consent', consent,
    'declaration', declaration, 'profile', profile,
    'activated', declaration,
    'complete', account and identity and consent and declaration,
    'next_step', case
      when not account then 'account'
      when not identity then 'identity'
      when not consent then 'consent'
      when not declaration then 'declaration'
      else 'done' end
  ) from s;
$fn$;
