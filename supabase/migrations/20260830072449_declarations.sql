create table public.declaration_visibilities (
  slug text primary key,
  name text not null,
  description text not null,
  sort_order smallint not null unique
);

insert into public.declaration_visibilities (slug, name, description, sort_order) values
  ('private','Private','Only the member and Region 17 matching can see it. It still counts toward aggregate region figures.',1),
  ('members','Members','Visible to signed-in members. The default.',2),
  ('public','Public','Visible to anyone, including on the region page.',3);

create table public.declarations (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references public.members (id) on delete restrict,
  direction       text not null,
  pathway_slug    text not null references public.pathways (slug) on update cascade on delete restrict,
  sector_slug     text references public.sectors (slug) on update cascade on delete restrict,
  place_slug      text not null references public.places (slug) on update cascade on delete restrict,
  headline        text not null,
  detail          text,
  capacity_note   text,
  available_from  date not null default current_date,
  available_until date not null,
  state           text not null default 'active',
  visibility      text not null default 'members'
                    references public.declaration_visibilities (slug) on update cascade on delete restrict,
  withdrawn_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint declarations_direction_value check (direction in ('offer','seek')),
  constraint declarations_state_value check (state in ('active','dormant','withdrawn')),
  constraint declarations_headline_length check (length(btrim(headline)) between 3 and 140),
  constraint declarations_detail_length check (detail is null or length(btrim(detail)) <= 2000),
  constraint declarations_window_valid check (available_until >= available_from),
  constraint declarations_withdrawn_timestamp check (state <> 'withdrawn' or withdrawn_at is not null),
  constraint declarations_active_not_withdrawn check (state <> 'active' or withdrawn_at is null)
);

comment on table public.declarations is
  'The atomic unit of the mobilization engine. Every ask and every offer is a row here, typed by pathway, scoped to a place, bounded by an availability window. Not a profile field: a member holds many, in both directions, across many places.';
comment on column public.declarations.available_until is
  'Mandatory. A declaration lapses to dormant rather than persisting forever, because a matching graph that never expires is 70 percent stale within a year. Renewal is one tap.';
comment on column public.declarations.sector_slug is
  'Null means the declaration applies across sectors. A logistics operator may not care which sector the need sits in.';
comment on column public.declarations.place_slug is
  'Scope. Can be a district, a region, or ghana for country-wide. Region pages roll up everything at or below them.';
comment on column public.declarations.visibility is
  'Set on the declaration, not the profile, so a member can be publicly open about expertise and private about capital.';

create index declarations_match_idx
  on public.declarations (place_slug, pathway_slug, direction, sector_slug)
  where state = 'active';
create index declarations_member_idx on public.declarations (member_id, state);
create index declarations_expiry_idx on public.declarations (available_until) where state = 'active';

create trigger declarations_touch before update on public.declarations
  for each row execute function public.touch_updated_at();

-- Places that cannot hold a declaration.
create or replace function public.declarations_validate_place()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if not exists (
    select 1 from public.places p
    where p.slug = new.place_slug
      and p.type_slug in ('country','region','district')
      and p.is_published
  ) then
    raise exception 'declarations scope to a published country, region or district; % is not one', new.place_slug
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$fn$;

create trigger declarations_validate_place_trg
  before insert or update of place_slug on public.declarations
  for each row execute function public.declarations_validate_place();

-- Lapse, not delete. Run on a schedule.
create or replace function public.expire_declarations()
returns integer language sql security definer set search_path = '' as $fn$
  with lapsed as (
    update public.declarations
       set state = 'dormant'
     where state = 'active' and available_until < current_date
     returning 1
  ) select count(*)::integer from lapsed;
$fn$;

comment on function public.expire_declarations() is
  'Moves elapsed declarations to dormant. Nothing is deleted; renewal reactivates. Schedule daily.';

alter table public.declaration_visibilities enable row level security;
alter table public.declarations enable row level security;
alter table public.declaration_visibilities force row level security;
alter table public.declarations force row level security;

revoke all on public.declaration_visibilities from anon, authenticated;
revoke all on public.declarations from anon, authenticated;
grant select on public.declaration_visibilities to anon, authenticated;
grant select, insert, update on public.declarations to authenticated;

create policy dv_select on public.declaration_visibilities
  for select to anon, authenticated using (true);

create policy declarations_select_own
  on public.declarations for select to authenticated
  using (member_id = public.current_member_id());

create policy declarations_select_members
  on public.declarations for select to authenticated
  using (state = 'active' and visibility in ('members','public'));

create policy declarations_select_public
  on public.declarations for select to anon
  using (state = 'active' and visibility = 'public');

create policy declarations_insert_own
  on public.declarations for insert to authenticated
  with check (member_id = public.current_member_id() and state = 'active' and withdrawn_at is null);

create policy declarations_update_own
  on public.declarations for update to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id());
