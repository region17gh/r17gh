create table public.activity_kinds (
  slug        text primary key,
  name        text not null,
  description text not null,
  visibility  text not null,
  sort_order  smallint not null unique,
  constraint activity_kinds_visibility check (visibility in ('public','members','internal'))
);

insert into public.activity_kinds (slug, name, description, visibility, sort_order) values
  ('need.published','Posting published','A place posting went live.','public',1),
  ('need.closed','Posting closed','A posting concluded.','public',2),
  ('role.granted','Representative named','Someone was named to represent a place.','public',3),
  ('place.depth_changed','Place depth changed','A place moved between listed, profiled and partnered.','public',4),
  ('engagement.matched','Engagement matched','Both sides accepted and identities were revealed.','members',5),
  ('engagement.delivered','Engagement delivered','An outcome was recorded against the place.','public',6),
  ('engagement.closed','Engagement closed','Concluded, with the story captured.','public',7),
  ('milestone.completed','Milestone completed','A milestone was reported complete by its owner.','members',8),
  ('engagement.opened','Interest expressed','A member expressed interest.','internal',9),
  ('engagement.reviewed','Review started','Triage began and the clock started.','internal',10),
  ('engagement.redirected','Engagement redirected','Routed to a better fit.','internal',11),
  ('engagement.held','Engagement held','Parked with a revisit date.','internal',12),
  ('declaration.created','Declaration made','A member declared an ask or an offer.','internal',13),
  ('declaration.lapsed','Declaration lapsed','An availability window elapsed.','internal',14);

create table public.activity_events (
  id            bigint generated always as identity primary key,
  kind_slug     text not null references public.activity_kinds (slug) on update cascade on delete restrict,
  actor_member_id uuid references public.members (id) on delete restrict,
  subject_kind  text not null,
  subject_id    text not null,
  place_slug    text references public.places (slug) on update cascade on delete restrict,
  payload       jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now()
);

comment on table public.activity_events is
  'Append-only. Written by database triggers, never by application code, so it cannot drift. Every region page, the member feed and all impact reporting read from here. Update and delete are blocked at trigger level, which holds regardless of role.';
comment on column public.activity_events.payload is
  'Slugs, titles, counts and states only. Never names, contact details or anything identifying. The actor is a member id and resolves only where policy allows.';
comment on column public.activity_events.place_slug is
  'Denormalised so region and district pages roll up without joining through four tables.';

create index activity_place_idx on public.activity_events (place_slug, occurred_at desc);
create index activity_kind_idx on public.activity_events (kind_slug, occurred_at desc);
create index activity_actor_idx on public.activity_events (actor_member_id, occurred_at desc);

create or replace function public.activity_append_only()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  raise exception 'activity_events is append-only; % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$fn$;

create trigger activity_no_update before update on public.activity_events
  for each statement execute function public.activity_append_only();
create trigger activity_no_delete before delete on public.activity_events
  for each statement execute function public.activity_append_only();

create or replace function public.log_activity(
  p_kind text, p_actor uuid, p_subject_kind text, p_subject_id text,
  p_place text, p_payload jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $fn$
  insert into public.activity_events (kind_slug, actor_member_id, subject_kind, subject_id, place_slug, payload)
  values (p_kind, p_actor, p_subject_kind, p_subject_id, p_place, coalesce(p_payload,'{}'::jsonb));
$fn$;

-- ---------------------------------------------------------------------------
-- emitters
-- ---------------------------------------------------------------------------

create or replace function public.trg_log_declaration()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('declaration.created', new.member_id, 'declaration', new.id::text, new.place_slug,
      jsonb_build_object('direction',new.direction,'pathway',new.pathway_slug,'sector',new.sector_slug));
  elsif new.state = 'dormant' and old.state = 'active' then
    perform public.log_activity('declaration.lapsed', new.member_id, 'declaration', new.id::text, new.place_slug,
      jsonb_build_object('pathway',new.pathway_slug));
  end if;
  return null;
end;
$fn$;

create trigger declarations_log after insert or update of state on public.declarations
  for each row execute function public.trg_log_declaration();

create or replace function public.trg_log_need()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.state = 'published' and old.state is distinct from 'published' then
    perform public.log_activity('need.published', new.published_by, 'need', new.id::text, new.place_slug,
      jsonb_build_object('direction',new.direction,'title',new.title,'sector',new.sector_slug,'status',new.status_slug));
  elsif new.status_slug = 'closed' and old.status_slug is distinct from 'closed' then
    perform public.log_activity('need.closed', null, 'need', new.id::text, new.place_slug,
      jsonb_build_object('title',new.title));
  end if;
  return null;
end;
$fn$;

create trigger needs_log after update on public.needs
  for each row execute function public.trg_log_need();

create or replace function public.trg_log_engagement()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare v_kind text;
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('engagement.opened', new.opened_by, 'engagement', new.id::text, new.place_slug,
      jsonb_build_object('direction',new.direction,'unsolicited', new.need_id is null));
    return null;
  end if;

  v_kind := case new.state
    when 'in-review'  then 'engagement.reviewed'
    when 'matched'    then 'engagement.matched'
    when 'redirected' then 'engagement.redirected'
    when 'held'       then 'engagement.held'
    when 'delivered'  then 'engagement.delivered'
    when 'closed'     then 'engagement.closed'
    else null end;

  if v_kind is not null and new.state is distinct from old.state then
    perform public.log_activity(v_kind, new.reviewed_by, 'engagement', new.id::text, new.place_slug,
      jsonb_build_object(
        'title', new.title,
        'direction', new.direction,
        'participants', (select count(*) from public.engagement_participants p
                          where p.engagement_id = new.id and p.left_at is null)));
  end if;
  return null;
end;
$fn$;

create trigger engagements_log after insert or update of state on public.engagements
  for each row execute function public.trg_log_engagement();

create or replace function public.trg_log_milestone()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare v_place text;
begin
  if new.completed_on is not null and old.completed_on is null then
    select place_slug into v_place from public.engagements where id = new.engagement_id;
    perform public.log_activity('milestone.completed', new.reported_by, 'milestone', new.id::text, v_place,
      jsonb_build_object('title',new.title,'engagement',new.engagement_id));
  end if;
  return null;
end;
$fn$;

create trigger milestones_log after update on public.milestones
  for each row execute function public.trg_log_milestone();

create or replace function public.trg_log_role()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if tg_op = 'INSERT' and new.subject_kind = 'place' and new.state = 'active' then
    perform public.log_activity('role.granted', new.member_id, 'role', new.id::text, new.subject_slug,
      jsonb_build_object('role', new.role_slug));
  end if;
  return null;
end;
$fn$;

create trigger roles_log after insert on public.roles
  for each row execute function public.trg_log_role();

create or replace function public.trg_log_place_depth()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.depth_slug is distinct from old.depth_slug then
    perform public.log_activity('place.depth_changed', null, 'place', new.slug, new.slug,
      jsonb_build_object('from', old.depth_slug, 'to', new.depth_slug));
  end if;
  return null;
end;
$fn$;

create trigger places_log after update of depth_slug on public.places
  for each row execute function public.trg_log_place_depth();

-- ---------------------------------------------------------------------------
-- rollup and reporting
-- ---------------------------------------------------------------------------

create or replace function public.place_descendants(p_slug text)
returns table (slug text) language sql stable security definer set search_path = '' as $fn$
  with recursive down as (
    select p_slug as slug
    union all
    select l.child_slug from public.place_links l join down on down.slug = l.parent_slug
    where l.link_type_slug = 'administrative'
  ) select slug from down;
$fn$;

create or replace function public.place_activity(p_slug text, p_limit integer default 25)
returns table (occurred_at timestamptz, kind text, name text, place_slug text, payload jsonb)
language sql stable security invoker set search_path = '' as $fn$
  select e.occurred_at, e.kind_slug, k.name, e.place_slug, e.payload
  from public.activity_events e
  join public.activity_kinds k on k.slug = e.kind_slug
  where k.visibility = 'public'
    and e.place_slug in (select slug from public.place_descendants(p_slug))
  order by e.occurred_at desc
  limit greatest(1, least(coalesce(p_limit,25), 100));
$fn$;

comment on function public.place_activity(text,integer) is
  'The region and district page activity stream. Public-visibility events only, rolled up across every place at or below the given one.';

create or replace function public.place_impact(p_slug text, p_floor integer default 5)
returns jsonb language sql stable security definer set search_path = '' as $fn$
  with scope as (select slug from public.place_descendants(p_slug)),
  raw as (
    select
      (select count(*) from public.declarations d where d.place_slug in (select slug from scope) and d.state='active') as declarations,
      (select count(distinct d.member_id) from public.declarations d where d.place_slug in (select slug from scope) and d.state='active') as members,
      (select count(*) from public.needs n where n.place_slug in (select slug from scope) and n.state='published') as postings,
      (select count(*) from public.engagements e where e.place_slug in (select slug from scope)) as engagements,
      (select count(*) from public.engagements e where e.place_slug in (select slug from scope) and e.state in ('delivered','closed')) as delivered
  )
  select jsonb_build_object(
    'place', p_slug,
    'suppression_floor', p_floor,
    'declarations', case when declarations >= p_floor then declarations else null end,
    'members',      case when members      >= p_floor then members      else null end,
    'postings',     postings,
    'engagements',  case when engagements  >= p_floor then engagements  else null end,
    'delivered',    case when delivered     >= p_floor then delivered    else null end,
    'note', 'Counts below the suppression floor return null. A cell of three people is personal data however it is labelled.'
  ) from raw;
$fn$;

comment on function public.place_impact(text,integer) is
  'Aggregate reporting for government and institutional partners. Person-derived counts below the floor are suppressed rather than reported. Postings are institutional, not personal, so they are never suppressed.';

alter table public.activity_kinds enable row level security;
alter table public.activity_events enable row level security;
alter table public.activity_kinds force row level security;
alter table public.activity_events force row level security;

revoke all on public.activity_kinds from anon, authenticated;
revoke all on public.activity_events from anon, authenticated;
grant select on public.activity_kinds to anon, authenticated;
grant select on public.activity_events to anon, authenticated;

create policy ak_select on public.activity_kinds for select to anon, authenticated using (true);

create policy activity_select_public on public.activity_events for select to anon
  using (exists (select 1 from public.activity_kinds k where k.slug = activity_events.kind_slug and k.visibility = 'public'));

create policy activity_select_members on public.activity_events for select to authenticated
  using (exists (select 1 from public.activity_kinds k where k.slug = activity_events.kind_slug and k.visibility in ('public','members')));

create policy activity_select_own on public.activity_events for select to authenticated
  using (actor_member_id = public.current_member_id());
