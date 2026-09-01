create table public.subscription_subject_kinds (
  slug text primary key,
  name text not null,
  source_table text not null,
  description text not null,
  sort_order smallint not null unique
);

insert into public.subscription_subject_kinds (slug, name, source_table, description, sort_order) values
  ('place','Place','public.places','Watch a region or district. The lowest-cost rung on the ladder and the first signal of regional intent.',1),
  ('need','Posting','public.needs','Follow a specific posting and hear when it moves.',2),
  ('member','Member','public.members','Follow another member''s public activity.',3);

create table public.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members (id) on delete restrict,
  subject_kind text not null references public.subscription_subject_kinds (slug) on update cascade on delete restrict,
  subject_id   text not null,
  notify       boolean not null default true,
  state        text not null default 'active',
  created_at   timestamptz not null default now(),
  ended_at     timestamptz,
  constraint subscriptions_state_value check (state in ('active','muted','ended')),
  constraint subscriptions_ended_stamped check (state <> 'ended' or ended_at is not null)
);

comment on table public.subscriptions is
  'Watching is attention. Declaring is capacity. They are deliberately separate tables: reporting that 400 members engaged with Volta when 380 of them bookmarked it would be dishonest. Both feed matching, with different weight.';
comment on column public.subscriptions.notify is
  'Watching without notification is a silent bookmark. Reaching a member is opt-in, which is also what Act 843 consent-per-purpose requires.';

create unique index subscriptions_one_per_subject
  on public.subscriptions (member_id, subject_kind, subject_id)
  where state <> 'ended';

create index subscriptions_subject_idx on public.subscriptions (subject_kind, subject_id) where state = 'active';
create index subscriptions_member_idx on public.subscriptions (member_id) where state <> 'ended';

create or replace function public.subscriptions_validate_subject()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.subject_kind = 'place' then
    if not exists (select 1 from public.places p where p.slug = new.subject_id and p.is_published) then
      raise exception 'no published place with slug %', new.subject_id using errcode = 'foreign_key_violation';
    end if;
  elsif new.subject_kind = 'need' then
    if not exists (select 1 from public.needs n where n.id::text = new.subject_id and n.state = 'published') then
      raise exception 'no published posting with id %', new.subject_id using errcode = 'foreign_key_violation';
    end if;
  elsif new.subject_kind = 'member' then
    if not exists (select 1 from public.members m where m.id::text = new.subject_id) then
      raise exception 'no member with id %', new.subject_id using errcode = 'foreign_key_violation';
    end if;
    if new.subject_id = new.member_id::text then
      raise exception 'a member cannot follow themselves' using errcode = 'check_violation';
    end if;
  else
    raise exception 'unknown subscription subject kind %', new.subject_kind using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger subscriptions_validate_subject_trg
  before insert or update of subject_kind, subject_id on public.subscriptions
  for each row execute function public.subscriptions_validate_subject();

-- Watchers hear about a new posting even when nothing in their declarations matches.
-- This is the second reason the platform moves first, and it is why a follow is worth having.
create or replace function public.notify_watchers_of_need(p_need uuid)
returns integer language plpgsql security definer set search_path = '' as $fn$
declare v_count integer := 0; n record; s record;
begin
  select id, title, place_slug, direction into n
  from public.needs where id = p_need and state = 'published';
  if n.id is null then return 0; end if;

  for s in
    select distinct sub.member_id
    from public.subscriptions sub
    where sub.subject_kind = 'place'
      and sub.state = 'active'
      and sub.notify
      and n.place_slug in (select slug from public.place_descendants(sub.subject_id))
      and not exists (
        select 1 from public.notifications x
        where x.member_id = sub.member_id
          and x.kind = 'match'
          and x.subject_kind = 'need'
          and x.subject_id = p_need::text
      )
  loop
    insert into public.notifications (member_id, kind, subject_kind, subject_id, title, body, url_path)
    select s.member_id, 'watched-place', 'need', p_need::text,
           case when n.direction = 'seek'
                then p.name || ' has posted something new'
                else p.name || ' is offering something new' end,
           n.title, p.url_path
    from public.places p where p.slug = n.place_slug;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$fn$;

comment on function public.notify_watchers_of_need(uuid) is
  'Deliberately skips anyone who already received a match notification for this posting, so a member who both watches the place and matched on capacity is told once, not twice.';

create or replace function public.needs_watcher_trg()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.state = 'published' and old.state is distinct from 'published' then
    perform public.notify_watchers_of_need(new.id);
  end if;
  return new;
end;
$fn$;

-- Runs after the matching trigger, so match notifications already exist and dedupe correctly.
create trigger needs_publish_watchers
  after update of state on public.needs
  for each row execute function public.needs_watcher_trg();

-- Watchers join the impact picture, under the same suppression floor.
create or replace function public.place_impact(p_slug text, p_floor integer default 5)
returns jsonb language sql stable security definer set search_path = '' as $fn$
  with scope as (select slug from public.place_descendants(p_slug)),
  raw as (
    select
      (select count(*) from public.subscriptions s
        where s.subject_kind='place' and s.state='active'
          and s.subject_id in (select slug from scope)) as watchers,
      (select count(*) from public.declarations d where d.place_slug in (select slug from scope) and d.state='active') as declarations,
      (select count(distinct d.member_id) from public.declarations d where d.place_slug in (select slug from scope) and d.state='active') as members,
      (select count(*) from public.needs n where n.place_slug in (select slug from scope) and n.state='published') as postings,
      (select count(*) from public.engagements e where e.place_slug in (select slug from scope)) as engagements,
      (select count(*) from public.engagements e where e.place_slug in (select slug from scope) and e.state in ('delivered','closed')) as delivered
  )
  select jsonb_build_object(
    'place', p_slug,
    'suppression_floor', p_floor,
    'watchers',     case when watchers     >= p_floor then watchers     else null end,
    'declarations', case when declarations >= p_floor then declarations else null end,
    'members',      case when members      >= p_floor then members      else null end,
    'postings',     postings,
    'engagements',  case when engagements  >= p_floor then engagements  else null end,
    'delivered',    case when delivered    >= p_floor then delivered    else null end,
    'note', 'Watching is attention and declaring is capacity. They are reported separately and never summed.'
  ) from raw;
$fn$;

alter table public.subscription_subject_kinds enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_subject_kinds force row level security;
alter table public.subscriptions force row level security;

revoke all on public.subscription_subject_kinds from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscription_subject_kinds to anon, authenticated;
grant select, insert, update on public.subscriptions to authenticated;

create policy ssk_select on public.subscription_subject_kinds for select to anon, authenticated using (true);

create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (member_id = public.current_member_id());
create policy subscriptions_insert_own on public.subscriptions
  for insert to authenticated with check (member_id = public.current_member_id() and state = 'active');
create policy subscriptions_update_own on public.subscriptions
  for update to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id());
