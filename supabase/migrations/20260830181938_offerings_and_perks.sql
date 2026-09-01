create table public.offering_types (
  slug text primary key,
  name text not null,
  description text not null,
  sort_order smallint not null unique
);

insert into public.offering_types (slug, name, description, sort_order) values
  ('program','Program','A cohort or initiative Region 17 convenes, mostly delivered off-platform.',1),
  ('event','Event','Town hall, summit, info session or meet-up. Virtual, in person or hybrid.',2),
  ('resource','Resource','A brief, toolkit, template or dataset.',3),
  ('knowledge','Knowledge transfer','Training, workshop or a mentorship series.',4),
  ('service','Service','Advisory, facilitation or delivery work.',5);

create table public.perk_kinds (
  slug text primary key,
  name text not null,
  description text not null,
  sort_order smallint not null unique
);

insert into public.perk_kinds (slug, name, description, sort_order) values
  ('free','Free to members','Non-members pay the list price; members pay nothing.',1),
  ('discount','Discounted for members','Members pay a reduced price.',2),
  ('priority','Priority access','Same price, members get first access or reserved capacity.',3),
  ('member-only','Members only','Not available to non-members at any price.',4);

comment on table public.perk_kinds is
  'Membership is free to join and to retain. The perk is the difference between what a member pays and what everyone else pays, which makes the benefit a number in a row rather than a claim on a page.';

create table public.offerings (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  type_slug         text not null references public.offering_types (slug) on update cascade on delete restrict,
  title             text not null,
  summary           text not null,
  detail            text,

  place_slug        text references public.places (slug) on update cascade on delete restrict,
  sector_slug       text references public.sectors (slug) on update cascade on delete restrict,
  audience          text not null default 'both',
  delivery          text not null default 'virtual',
  entity            text not null,

  starts_at         timestamptz,
  ends_at           timestamptz,
  location          text,
  capacity          integer,

  list_price_amount   numeric(12,2),
  list_price_currency text,
  registration_url    text,

  state             text not null default 'draft',
  published_at      timestamptz,
  published_by      uuid references public.members (id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint offerings_slug_format check (slug ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  constraint offerings_title_length check (length(btrim(title)) between 3 and 160),
  constraint offerings_summary_length check (length(btrim(summary)) between 10 and 600),
  constraint offerings_audience_value check (audience in ('diaspora','continental','both')),
  constraint offerings_delivery_value check (delivery in ('virtual','in-person','hybrid','on-demand')),
  constraint offerings_entity_value check (entity in ('nonprofit','for-profit')),
  constraint offerings_state_value check (state in ('draft','published','closed','cancelled')),
  constraint offerings_currency_shape check (list_price_currency is null or list_price_currency ~ '^[A-Z]{3}$'),
  constraint offerings_price_needs_currency check (list_price_amount is null or list_price_currency is not null),
  constraint offerings_capacity_positive check (capacity is null or capacity > 0),
  constraint offerings_ends_after_starts check (ends_at is null or starts_at is null or ends_at >= starts_at),
  constraint offerings_published_stamped check (state <> 'published' or (published_at is not null and published_by is not null))
);

comment on table public.offerings is
  'Programs, events, resources, knowledge transfer and services are one object family. They differ in delivery, not in structure. Every one carries a place and a sector, so it appears on the region page, feeds matching, and writes to the activity ledger.';
comment on column public.offerings.audience is
  'Region 17 targets the diaspora and continental Africa only. Recording which lets an offering be built deliberately for one side or for both working in concert.';
comment on column public.offerings.registration_url is
  'Where registration and payment actually happen. The DMP records the offering and the member benefit; it does not take money, which would pull Stripe, tax, refunds and the entity question into scope.';
comment on column public.offerings.entity is
  'Which Region 17 entity runs it. Recorded per offering so the books separate from day one without deciding the whole structure today.';

create index offerings_place_idx on public.offerings (place_slug, starts_at) where state = 'published';
create index offerings_type_idx on public.offerings (type_slug) where state = 'published';
create index offerings_upcoming_idx on public.offerings (starts_at) where state = 'published';

create trigger offerings_touch before update on public.offerings
  for each row execute function public.touch_updated_at();

create table public.offering_perks (
  offering_id      uuid primary key references public.offerings (id) on delete cascade,
  perk_kind        text not null references public.perk_kinds (slug) on update cascade on delete restrict,
  discount_percent smallint,
  member_price_amount numeric(12,2),
  member_price_currency text,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint perks_discount_range check (discount_percent is null or discount_percent between 1 and 100),
  constraint perks_currency_shape check (member_price_currency is null or member_price_currency ~ '^[A-Z]{3}$'),
  constraint perks_price_needs_currency check (member_price_amount is null or member_price_currency is not null),
  -- A discount that states no discount is not a perk.
  constraint perks_discount_needs_value check (
    perk_kind <> 'discount' or discount_percent is not null or member_price_amount is not null)
);

comment on table public.offering_perks is
  'What membership is actually worth on this offering. A membership page renders from these rows, so "what does my membership get me" is a query rather than a brochure.';

create trigger perks_touch before update on public.offering_perks
  for each row execute function public.touch_updated_at();

create table public.offering_tags (
  offering_id uuid not null references public.offerings (id) on delete cascade,
  tag_slug    text not null references public.opportunity_tags (slug) on update cascade on delete restrict,
  primary key (offering_id, tag_slug)
);

create table public.offering_registrations (
  offering_id  uuid not null references public.offerings (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete restrict,
  state        text not null default 'registered',
  registered_at timestamptz not null default now(),
  attended_at  timestamptz,
  external_ref text,
  note         text,
  primary key (offering_id, member_id),
  constraint reg_state_value check (state in ('registered','waitlisted','attended','cancelled','no-show'))
);

comment on table public.offering_registrations is
  'Member registrations only. Non-members buy through whatever sells the ticket; their money is revenue, not membership data. Attendance is what turns outside-the-platform work into a measurable event inside it.';

create index reg_member_idx on public.offering_registrations (member_id, state);

-- Offerings attach only to published places, same rule as needs.
create or replace function public.offerings_validate_place()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if new.place_slug is not null and not exists (
    select 1 from public.places p where p.slug = new.place_slug and p.is_published
  ) then
    raise exception 'offerings attach to a published place; % is not published', new.place_slug
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$fn$;

create trigger offerings_validate_place_trg
  before insert or update of place_slug on public.offerings
  for each row execute function public.offerings_validate_place();

-- Capacity is enforced, not advisory.
create or replace function public.registrations_enforce_capacity()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare v_cap integer; v_taken integer; v_state text;
begin
  select capacity, state into v_cap, v_state from public.offerings where id = new.offering_id;
  if v_state <> 'published' then
    raise exception 'offering is not open for registration' using errcode = 'check_violation';
  end if;
  if v_cap is not null and new.state = 'registered' then
    select count(*) into v_taken from public.offering_registrations
     where offering_id = new.offering_id and state in ('registered','attended');
    if v_taken >= v_cap then
      new.state := 'waitlisted';
    end if;
  end if;
  return new;
end;
$fn$;

create trigger registrations_capacity before insert on public.offering_registrations
  for each row execute function public.registrations_enforce_capacity();

-- Ledger and notifications
insert into public.activity_kinds (slug, name, description, visibility, sort_order) values
  ('offering.published','Perk published','Region 17 published a program, event, resource or service.','public',15),
  ('offering.attended','Perk attended','A member attended.','members',16);

insert into public.notification_kinds (slug, name, description, is_essential, default_email, default_cadence, sort_order)
values ('offering','New from Region 17','A program, event or resource in a place you follow.', false, true, 'daily', 11);

create or replace function public.trg_log_offering()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.state = 'published' and old.state is distinct from 'published' then
    perform public.log_activity('offering.published', new.published_by, 'offering', new.id::text, new.place_slug,
      jsonb_build_object('type', new.type_slug, 'title', new.title, 'audience', new.audience));
    perform public.notify_watchers_of_offering(new.id);
  end if;
  return null;
end;
$fn$;

create or replace function public.notify_watchers_of_offering(p_offering uuid)
returns integer language plpgsql security definer set search_path = '' as $fn$
declare v_count integer := 0; o record; s record;
begin
  select id, title, place_slug, type_slug, summary into o
  from public.offerings where id = p_offering and state = 'published';
  if o.id is null or o.place_slug is null then return 0; end if;

  for s in
    select distinct sub.member_id
    from public.subscriptions sub
    where sub.subject_kind = 'place' and sub.state = 'active' and sub.notify
      and o.place_slug in (select slug from public.place_descendants(sub.subject_id))
  loop
    insert into public.notifications (member_id, kind, subject_kind, subject_id, title, body, url_path)
    select s.member_id, 'offering', 'offering', p_offering::text,
           p.name || ': ' || o.title, o.summary, 'perks/' || o.id::text
    from public.places p where p.slug = o.place_slug;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$fn$;

create trigger offerings_log after update of state on public.offerings
  for each row execute function public.trg_log_offering();

create or replace function public.trg_log_attendance()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare v_place text; v_title text;
begin
  if new.state = 'attended' and old.state is distinct from 'attended' then
    select place_slug, title into v_place, v_title from public.offerings where id = new.offering_id;
    perform public.log_activity('offering.attended', new.member_id, 'offering', new.offering_id::text, v_place,
      jsonb_build_object('title', v_title));
  end if;
  return null;
end;
$fn$;

create trigger registrations_log after update of state on public.offering_registrations
  for each row execute function public.trg_log_attendance();

-- What a membership is worth, as a query.
create or replace function public.member_perks(p_limit integer default 50)
returns table (
  offering_id uuid, slug text, type text, title text, summary text,
  place_slug text, place_name text, audience text, starts_at timestamptz,
  list_price numeric, list_currency text,
  perk_kind text, discount_percent smallint, member_price numeric, member_currency text,
  registration_url text
) language sql stable security invoker set search_path = '' as $fn$
  select o.id, o.slug, o.type_slug, o.title, o.summary,
         o.place_slug, p.name, o.audience, o.starts_at,
         o.list_price_amount, o.list_price_currency,
         k.perk_kind, k.discount_percent, k.member_price_amount, k.member_price_currency,
         o.registration_url
  from public.offerings o
  left join public.places p on p.slug = o.place_slug
  left join public.offering_perks k on k.offering_id = o.id
  where o.state = 'published'
  order by o.starts_at nulls last, o.created_at desc
  limit greatest(1, least(coalesce(p_limit,50), 200));
$fn$;

comment on function public.member_perks(integer) is
  'Renders the membership value page. Runs security invoker, so it shows exactly what the caller may see.';

do $rls$
declare t text;
begin
  foreach t in array array['offering_types','perk_kinds','offerings','offering_perks','offering_tags','offering_registrations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end;
$rls$;

grant insert, update on public.offering_registrations to authenticated;

create policy ot2_select on public.offering_types for select to anon, authenticated using (true);
create policy pk_select on public.perk_kinds for select to anon, authenticated using (true);

create policy offerings_select_published on public.offerings for select to anon, authenticated
  using (state in ('published','closed'));

create policy perks_select on public.offering_perks for select to anon, authenticated
  using (exists (select 1 from public.offerings o where o.id = offering_perks.offering_id and o.state in ('published','closed')));

create policy otags_select on public.offering_tags for select to anon, authenticated
  using (exists (select 1 from public.offerings o where o.id = offering_tags.offering_id and o.state in ('published','closed')));

create policy reg_select_own on public.offering_registrations for select to authenticated
  using (member_id = public.current_member_id());
create policy reg_insert_own on public.offering_registrations for insert to authenticated
  with check (member_id = public.current_member_id() and state in ('registered','waitlisted'));
create policy reg_update_own on public.offering_registrations for update to authenticated
  using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());
