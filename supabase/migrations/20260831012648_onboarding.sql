-- Onboarding exists to produce a declaration. A member who joins with a complete
-- profile and no declaration is invisible to the engine: no notifications, no
-- recruit results, no contribution to any region's figures. Profile completeness
-- is not the metric. First declaration is.

create table public.onboarding_steps (
  slug text primary key,
  name text not null,
  description text not null,
  is_required boolean not null default true,
  sort_order smallint not null unique
);

insert into public.onboarding_steps (slug, name, description, is_required, sort_order) values
  ('account','Account','Email verified and a member number issued.',true,1),
  ('identity','Identity','Name, how they connect to Ghana, and their timezone.',true,2),
  ('consent','Consent','Purpose-by-purpose, not one blanket box.',true,3),
  ('declaration','First declaration','What they can bring or what they are looking for, and where. The flow is not finished without it.',true,4),
  ('profile','Profile depth','Skills, languages, links. Genuinely optional.',false,5);

create table public.member_onboarding (
  member_id       uuid primary key references public.members (id) on delete restrict,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  current_step    text not null default 'account'
                    references public.onboarding_steps (slug) on update cascade on delete restrict,
  referral_source text,
  campaign_code   text,
  updated_at      timestamptz not null default now()
);

comment on column public.member_onboarding.campaign_code is
  'Which event or promotion brought them. Lets ladder conversion be measured from first contact rather than from registration.';

create trigger mo_touch before update on public.member_onboarding
  for each row execute function public.touch_updated_at();

create or replace function public.member_is_activated(p_member uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from public.declarations d
    where d.member_id = p_member and d.state = 'active' and d.available_until >= current_date
  );
$fn$;

comment on function public.member_is_activated(uuid) is
  'Holds at least one live declaration. Not "completed the form" — a member with a full profile and no declaration cannot be matched, notified or recruited.';

create or replace function public.onboarding_status(p_member uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $fn$
  with m as (select coalesce(p_member, public.current_member_id()) as id),
  s as (
    select
      (select count(*) > 0 from public.members x where x.id = (select id from m)) as account,
      (select count(*) > 0 from public.members x where x.id = (select id from m)
        and x.display_name is not null and x.timezone is not null) as identity,
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
         connection_type = p_connection,
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

  -- Declaring in a place implies caring about it. Seeds the watcher count and
  -- gives the member a second reason to hear from us.
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

comment on function public.complete_onboarding is
  'Identity, consents, first declaration and a follow, in one transaction. Either the member finishes activated or nothing is written, so the flow cannot leave someone the engine will never see.';

create or replace function public.ops_activation(p_days integer default 30)
returns jsonb language sql stable security definer set search_path = '' as $fn$
  with camp as (
    select coalesce(o.campaign_code,'(direct)') as campaign,
           count(*) as joined,
           count(*) filter (where public.member_is_activated(o.member_id)) as activated
    from public.member_onboarding o
    group by coalesce(o.campaign_code,'(direct)')
  )
  select case when not public.is_operator() then null else jsonb_build_object(
    'members', (select count(*) from public.members where status <> 'erased'),
    'onboarding_started', (select count(*) from public.member_onboarding),
    'onboarding_complete', (select count(*) from public.member_onboarding where completed_at is not null),
    'activated', (select count(*) from public.members m where public.member_is_activated(m.id)),
    'activated_recent', (select count(*) from public.members m
                          where public.member_is_activated(m.id)
                            and m.created_at >= now() - (p_days || ' days')::interval),
    'stalled_no_declaration', (select count(*) from public.member_onboarding o
                                where o.completed_at is null
                                  and not public.member_is_activated(o.member_id)),
    'by_campaign', coalesce((select jsonb_agg(jsonb_build_object(
        'campaign', c.campaign, 'joined', c.joined, 'activated', c.activated) order by c.joined desc)
      from camp c), '[]'::jsonb),
    'note', 'Activated means holding a live declaration. A member without one cannot be matched, notified or recruited.'
  ) end;
$fn$;

alter table public.onboarding_steps enable row level security;
alter table public.member_onboarding enable row level security;
alter table public.onboarding_steps force row level security;
alter table public.member_onboarding force row level security;

revoke all on public.onboarding_steps from anon, authenticated;
revoke all on public.member_onboarding from anon, authenticated;
grant select on public.onboarding_steps to anon, authenticated;
grant select, insert, update on public.member_onboarding to authenticated;

create policy os2_select on public.onboarding_steps for select to anon, authenticated using (true);
create policy mo_own on public.member_onboarding for select to authenticated
  using (member_id = public.current_member_id());
create policy mo_insert_own on public.member_onboarding for insert to authenticated
  with check (member_id = public.current_member_id());
create policy mo_update_own on public.member_onboarding for update to authenticated
  using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());

revoke all on function public.complete_onboarding(text,public.connection_type,text,text[],text,text,text,text,text,text,text,integer,text) from public, anon;
grant execute on function public.complete_onboarding(text,public.connection_type,text,text[],text,text,text,text,text,text,text,integer,text) to authenticated, service_role;
revoke all on function public.onboarding_status(uuid) from public, anon;
grant execute on function public.onboarding_status(uuid) to authenticated, service_role;
revoke all on function public.member_is_activated(uuid) from public, anon;
grant execute on function public.member_is_activated(uuid) to authenticated, service_role;
revoke all on function public.ops_activation(integer) from public, anon;
grant execute on function public.ops_activation(integer) to authenticated, service_role;
