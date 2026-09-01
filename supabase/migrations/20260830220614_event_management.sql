-- Event management around Zoom rather than instead of it. Region 17 owns
-- scheduling, run of show, promotion, registration, check-in, permissions and
-- analytics; Zoom owns the video. The reason to own the rest is that only this
-- system can measure whether an event produced declarations.

alter table public.offerings
  add column chapter_slug text,
  add column scope_mode text not null default 'exact',
  add column timezone text not null default 'UTC',
  add column host_platform text,
  add column external_event_id text,
  add column join_url text,
  add column replay_url text,
  add column doors_open_minutes smallint not null default 15,
  add constraint offerings_scope_mode check (scope_mode in ('exact','inclusive')),
  add constraint offerings_host_platform check (host_platform is null or host_platform in ('zoom','in-person','other')),
  add constraint offerings_doors_range check (doors_open_minutes between 0 and 120);

comment on column public.offerings.scope_mode is
  'exact renders on the scoped place only. inclusive also renders on every place beneath it, so a Volta spotlight appears on all eighteen district pages without a second content system.';
comment on column public.offerings.chapter_slug is
  'Diaspora-side scope. A Washington summit is not a Ghanaian regional event but it is a DC chapter event. Places are destinations, chapters are origins, and offerings happen at both ends.';
comment on column public.offerings.external_event_id is
  'Zoom meeting or webinar id. Attendance can be reconciled from the Zoom participant report rather than typed in.';

create index offerings_chapter_idx on public.offerings (chapter_slug) where state = 'published';

create or replace function public.offerings_validate_scope()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.place_slug is not null and not exists (
    select 1 from public.places p where p.slug = new.place_slug and p.is_published
  ) then
    raise exception 'offerings attach to a published place; % is not published', new.place_slug
      using errcode = 'foreign_key_violation';
  end if;

  if new.chapter_slug is not null and not exists (
    select 1 from public.chapters c where c.slug = new.chapter_slug
  ) then
    raise exception 'no chapter with slug %', new.chapter_slug using errcode = 'foreign_key_violation';
  end if;

  if new.type_slug = 'event' and new.starts_at is null then
    raise exception 'an event needs a start time' using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

drop trigger if exists offerings_validate_place_trg on public.offerings;
create trigger offerings_validate_scope_trg
  before insert or update of place_slug, chapter_slug, type_slug, starts_at on public.offerings
  for each row execute function public.offerings_validate_scope();

-- ---------------------------------------------------------------------------
-- run of show
-- ---------------------------------------------------------------------------

create table public.event_segments (
  id           uuid primary key default gen_random_uuid(),
  offering_id  uuid not null references public.offerings (id) on delete cascade,
  sequence     smallint not null,
  title        text not null,
  minutes      smallint,
  notes        text,
  speaker_name text,
  speaker_role text,
  created_at   timestamptz not null default now(),
  constraint seg_sequence_positive check (sequence > 0),
  constraint seg_minutes_range check (minutes is null or minutes between 1 and 600),
  constraint seg_title_length check (length(btrim(title)) between 2 and 160)
);

create unique index seg_order_key on public.event_segments (offering_id, sequence);

comment on table public.event_segments is
  'The run of show. Also the public agenda, so the same rows drive the event page and the operator brief.';

-- ---------------------------------------------------------------------------
-- promotion with attribution
-- ---------------------------------------------------------------------------

create table public.event_campaigns (
  id          uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.offerings (id) on delete cascade,
  code        text not null,
  name        text not null,
  channel     text not null,
  partner     text,
  created_at  timestamptz not null default now(),
  constraint camp_code_format check (code ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  constraint camp_channel_value check (channel in ('email','social','partner','embassy','chapter','press','direct','other'))
);

create unique index camp_code_key on public.event_campaigns (offering_id, code);

comment on table public.event_campaigns is
  'One row per promotion route, each with a code appended to the registration link. This is how "which channel actually brought people" stops being a guess.';

-- ---------------------------------------------------------------------------
-- registration, check-in, attribution
-- ---------------------------------------------------------------------------

alter table public.offering_registrations
  add column campaign_code text,
  add column referrer text,
  add column check_in_code text,
  add column checked_in_at timestamptz,
  add column checked_in_by uuid references public.members (id) on delete restrict,
  add column check_in_method text,
  add constraint reg_checkin_method check (check_in_method is null or check_in_method in ('self','staff','zoom','auto'));

create unique index reg_checkin_code_key on public.offering_registrations (check_in_code) where check_in_code is not null;
create index reg_campaign_idx on public.offering_registrations (offering_id, campaign_code);

create or replace function public.registrations_issue_code()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.check_in_code is null then
    new.check_in_code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
  end if;
  return new;
end;
$fn$;

create trigger registrations_code before insert on public.offering_registrations
  for each row execute function public.registrations_issue_code();

-- Checking in is what marks attendance. One path, so the funnel cannot drift.
create or replace function public.check_in(p_code text, p_method text default 'staff')
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare r record; v_actor uuid;
begin
  v_actor := public.current_member_id();
  if not (public.is_operator() or exists (
    select 1 from public.offering_registrations reg
    join public.offerings o on o.id = reg.offering_id
    join public.roles ro on ro.member_id = v_actor and ro.state = 'active'
      and ro.role_slug in ('event-manager','event-host')
    where reg.check_in_code = upper(btrim(p_code))
  )) then
    return jsonb_build_object('ok', false, 'reason', 'not permitted');
  end if;

  select * into r from public.offering_registrations where check_in_code = upper(btrim(p_code));
  if r.check_in_code is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown code');
  end if;
  if r.checked_in_at is not null then
    return jsonb_build_object('ok', true, 'already', true, 'at', r.checked_in_at);
  end if;

  update public.offering_registrations
     set state = 'attended', checked_in_at = now(), checked_in_by = v_actor,
         check_in_method = p_method, attended_at = now()
   where offering_id = r.offering_id and member_id = r.member_id;

  return jsonb_build_object('ok', true, 'offering_id', r.offering_id, 'member_id', r.member_id);
end;
$fn$;

-- A cancellation should promote the top of the waitlist rather than leave a seat empty.
create or replace function public.promote_from_waitlist()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare v_cap integer; v_taken integer; v_next record;
begin
  if new.state = 'cancelled' and old.state in ('registered','attended') then
    select capacity into v_cap from public.offerings where id = new.offering_id;
    if v_cap is null then return null; end if;

    select count(*) into v_taken from public.offering_registrations
     where offering_id = new.offering_id and state in ('registered','attended');

    if v_taken < v_cap then
      select * into v_next from public.offering_registrations
       where offering_id = new.offering_id and state = 'waitlisted'
       order by registered_at limit 1;

      if v_next.member_id is not null then
        update public.offering_registrations set state = 'registered'
         where offering_id = v_next.offering_id and member_id = v_next.member_id;

        insert into public.notifications (member_id, kind, subject_kind, subject_id, title, body, url_path)
        select v_next.member_id, 'offering', 'offering', new.offering_id::text,
               'A place opened up: ' || o.title, o.summary, 'perks/' || o.id::text
        from public.offerings o where o.id = new.offering_id;
      end if;
    end if;
  end if;
  return null;
end;
$fn$;

create trigger registrations_promote after update of state on public.offering_registrations
  for each row execute function public.promote_from_waitlist();

-- ---------------------------------------------------------------------------
-- team permissions, reusing the one role system
-- ---------------------------------------------------------------------------

insert into public.role_types (slug, name, description, subject_kind, grants_need_submission, sort_order) values
  ('content-editor','Content editor','May compose offerings for a place and everything beneath it. Publishing stays with platform operators.','place',false,9),
  ('event-manager','Event manager','Runs events for a place: run of show, campaigns, check-in, attendance.','place',false,10),
  ('event-host','Event host','Checks attendees in on the day. Nothing else.','place',false,11);

-- ---------------------------------------------------------------------------
-- analytics: the funnel, and the thing no external platform can compute
-- ---------------------------------------------------------------------------

create or replace function public.event_funnel(p_offering uuid)
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select case when not (public.is_operator() or exists (
      select 1 from public.roles r where r.member_id = public.current_member_id()
        and r.state='active' and r.role_slug in ('event-manager','event-host'))) then null
  else jsonb_build_object(
    'offering_id', p_offering,
    'capacity', (select capacity from public.offerings where id = p_offering),
    'registered', (select count(*) from public.offering_registrations where offering_id=p_offering and state='registered'),
    'waitlisted', (select count(*) from public.offering_registrations where offering_id=p_offering and state='waitlisted'),
    'attended',   (select count(*) from public.offering_registrations where offering_id=p_offering and state='attended'),
    'cancelled',  (select count(*) from public.offering_registrations where offering_id=p_offering and state='cancelled'),
    'no_show',    (select count(*) from public.offering_registrations
                    where offering_id=p_offering and state='registered'
                      and exists (select 1 from public.offerings o where o.id=p_offering and o.ends_at < now())),
    'by_campaign', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', coalesce(c.code,'(none)'), 'name', coalesce(c.name,'Untracked'),
        'channel', c.channel, 'registered', x.n, 'attended', x.a) order by x.n desc)
      from (
        select reg.campaign_code as code, count(*) as n,
               count(*) filter (where reg.state='attended') as a
        from public.offering_registrations reg
        where reg.offering_id = p_offering group by reg.campaign_code
      ) x left join public.event_campaigns c on c.offering_id = p_offering and c.code = x.code
    ), '[]'::jsonb)
  ) end;
$fn$;

create or replace function public.event_conversion(p_offering uuid, p_days integer default 14)
returns jsonb language sql stable security definer set search_path = '' as $fn$
  with o as (select id, place_slug, ends_at, starts_at from public.offerings where id = p_offering),
  scope as (select slug from public.place_descendants((select coalesce(place_slug,'ghana') from o))),
  attendees as (
    select member_id, attended_at from public.offering_registrations
    where offering_id = p_offering and state = 'attended'
  ),
  declared as (
    select distinct a.member_id from attendees a
    join public.declarations d on d.member_id = a.member_id
     and d.created_at >= a.attended_at
     and d.created_at <= a.attended_at + (p_days || ' days')::interval
     and d.place_slug in (select slug from scope)
  ),
  engaged as (
    select distinct a.member_id from attendees a
    join public.engagements e on e.opened_by = a.member_id
     and e.opened_at >= a.attended_at
     and e.opened_at <= a.attended_at + (p_days || ' days')::interval
     and e.place_slug in (select slug from scope)
  ),
  watched as (
    select distinct a.member_id from attendees a
    join public.subscriptions s on s.member_id = a.member_id
     and s.subject_kind = 'place'
     and s.created_at >= a.attended_at
     and s.created_at <= a.attended_at + (p_days || ' days')::interval
  )
  select case when not public.is_operator() then null else jsonb_build_object(
    'offering_id', p_offering,
    'window_days', p_days,
    'attended', (select count(*) from attendees),
    'then_watched', (select count(*) from watched),
    'then_declared', (select count(*) from declared),
    'then_engaged', (select count(*) from engaged),
    'note', 'Attendance is theatre. Declarations are mobilization. This is the number the event is judged on.'
  ) end;
$fn$;

comment on function public.event_conversion(uuid,integer) is
  'How many attendees went on to watch, declare or engage in the event''s place within the window. No external event platform can compute this, because none of them hold the register. This is the reason to own the system.';

do $g$
declare f text;
begin
  foreach f in array array[
    'public.check_in(text,text)',
    'public.event_funnel(uuid)',
    'public.event_conversion(uuid,integer)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  revoke all on function public.promote_from_waitlist() from public, anon, authenticated;
  revoke all on function public.registrations_issue_code() from public, anon, authenticated;
  revoke all on function public.offerings_validate_scope() from public, anon, authenticated;
end;
$g$;

alter table public.event_segments enable row level security;
alter table public.event_campaigns enable row level security;
alter table public.event_segments force row level security;
alter table public.event_campaigns force row level security;

revoke all on public.event_segments from anon, authenticated;
revoke all on public.event_campaigns from anon, authenticated;
grant select on public.event_segments to anon, authenticated;
grant select on public.event_campaigns to authenticated;

create policy seg_select on public.event_segments for select to anon, authenticated
  using (exists (select 1 from public.offerings o where o.id = event_segments.offering_id and o.state in ('published','closed')));

create policy camp_select on public.event_campaigns for select to authenticated
  using (public.is_operator() or exists (
    select 1 from public.roles r where r.member_id = public.current_member_id()
      and r.state='active' and r.role_slug in ('event-manager','event-host')));
