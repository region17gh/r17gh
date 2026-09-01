-- Closes the universal post composer: media with credits, render targets,
-- scheduled publication, and the chapter-side surface.

create table public.media_assets (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null unique,
  kind          text not null default 'image',
  alt_text      text not null,
  caption       text,
  credit        text not null,
  credit_url    text,
  licence       text not null default 'unknown',
  place_slug    text references public.places (slug) on update cascade on delete set null,
  width         integer,
  height        integer,
  byte_size     bigint,
  is_cleared    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint media_kind_value check (kind in ('image','video','audio','document')),
  constraint media_licence_value check (licence in ('owned','licensed','permission','creative-commons','public-domain','unknown')),
  constraint media_alt_required check (length(btrim(alt_text)) between 3 and 300),
  constraint media_credit_required check (length(btrim(credit)) >= 2),
  constraint media_cleared_needs_licence check (is_cleared = false or licence <> 'unknown')
);

comment on table public.media_assets is
  'Every image carries a credit and a licence, because a page that cites sources for its facts and steals its photographs is not credible. place_slug pushes toward pictures of the actual place rather than stock imagery.';
comment on column public.media_assets.is_cleared is
  'False until someone confirms Region 17 may actually use it. Uncleared media cannot attach to a published offering. The watermarked launch photography is exactly this case.';

create index media_place_idx on public.media_assets (place_slug) where is_cleared;
create trigger media_touch before update on public.media_assets
  for each row execute function public.touch_updated_at();

create table public.offering_media (
  offering_id uuid not null references public.offerings (id) on delete cascade,
  media_id    uuid not null references public.media_assets (id) on delete restrict,
  role        text not null default 'gallery',
  sequence    smallint not null default 1,
  primary key (offering_id, media_id),
  constraint om_role_value check (role in ('hero','card','gallery','logo'))
);

create unique index om_one_hero on public.offering_media (offering_id) where role = 'hero';
create unique index om_one_card on public.offering_media (offering_id) where role = 'card';

create or replace function public.offering_media_require_clearance()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if not exists (select 1 from public.media_assets m where m.id = new.media_id and m.is_cleared) then
    if exists (select 1 from public.offerings o where o.id = new.offering_id and o.state = 'published') then
      raise exception 'media % is not cleared for use and cannot attach to a published offering', new.media_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$fn$;

create trigger offering_media_clearance before insert or update on public.offering_media
  for each row execute function public.offering_media_require_clearance();

create or replace function public.offerings_block_publish_uncleared()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.state = 'published' and (tg_op = 'INSERT' or old.state is distinct from 'published') then
    if exists (
      select 1 from public.offering_media om
      join public.media_assets m on m.id = om.media_id
      where om.offering_id = new.id and not m.is_cleared
    ) then
      raise exception 'cannot publish: this offering carries media that is not cleared'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$fn$;

create trigger offerings_clearance before insert or update of state on public.offerings
  for each row execute function public.offerings_block_publish_uncleared();

create table public.render_surfaces (
  slug text primary key,
  name text not null,
  description text not null,
  sort_order smallint not null unique
);

insert into public.render_surfaces (slug, name, description, sort_order) values
  ('commons','Commons','The national homepage. Selects, never authors.',1),
  ('region','Region page','The scoped region, and every district beneath it when scope_mode is inclusive.',2),
  ('district','District page','District pages only.',3),
  ('chapter','Chapter page','The diaspora-side chapter surface.',4),
  ('perks','Perks index','The membership value page.',5),
  ('dashboard','Member dashboard','Surfaced to members it is relevant to.',6);

create table public.offering_surfaces (
  offering_id  uuid not null references public.offerings (id) on delete cascade,
  surface_slug text not null references public.render_surfaces (slug) on update cascade on delete restrict,
  variant      text not null default 'card',
  priority     smallint not null default 100,
  primary key (offering_id, surface_slug),
  constraint os_variant_value check (variant in ('hero','feature','card','row')),
  constraint os_priority_range check (priority between 1 and 1000)
);

comment on table public.offering_surfaces is
  'One composer, many destinations. The same offering renders as a hero on the perks index and a row on a district page without duplicating the content.';

create or replace function public.offerings_default_surfaces()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  insert into public.offering_surfaces (offering_id, surface_slug, variant)
  values (new.id, 'perks', 'card') on conflict do nothing;

  if new.place_slug is not null then
    insert into public.offering_surfaces (offering_id, surface_slug, variant)
    values (new.id, 'region', 'card') on conflict do nothing;
    if new.scope_mode = 'inclusive' then
      insert into public.offering_surfaces (offering_id, surface_slug, variant)
      values (new.id, 'district', 'row') on conflict do nothing;
    end if;
  end if;

  if new.chapter_slug is not null then
    insert into public.offering_surfaces (offering_id, surface_slug, variant)
    values (new.id, 'chapter', 'card') on conflict do nothing;
  end if;

  return null;
end;
$fn$;

create trigger offerings_surfaces after insert on public.offerings
  for each row execute function public.offerings_default_surfaces();

alter table public.offerings
  add column publish_at timestamptz,
  add column unpublish_at timestamptz,
  add constraint offerings_unpublish_after_publish
    check (unpublish_at is null or publish_at is null or unpublish_at > publish_at);

comment on column public.offerings.publish_at is
  'Goes live without anyone remembering. A campaign is a sequence of things appearing on days chosen in advance.';

create index offerings_scheduled_idx on public.offerings (publish_at)
  where state = 'draft' and publish_at is not null;

create or replace function public.publish_scheduled_offerings()
returns integer language plpgsql security definer set search_path = '' as $fn$
declare v_published integer := 0; v_closed integer := 0; r record;
begin
  for r in
    select o.id from public.offerings o
    where o.state = 'draft' and o.publish_at is not null and o.publish_at <= now()
      and not exists (
        select 1 from public.offering_media om join public.media_assets m on m.id = om.media_id
        where om.offering_id = o.id and not m.is_cleared)
  loop
    update public.offerings set state = 'published', published_at = now() where id = r.id;
    v_published := v_published + 1;
  end loop;

  update public.offerings set state = 'closed'
   where state = 'published' and unpublish_at is not null and unpublish_at <= now();
  get diagnostics v_closed = row_count;

  return v_published + v_closed;
end;
$fn$;

comment on function public.publish_scheduled_offerings() is
  'Runs every ten minutes. Skips anything carrying uncleared media rather than failing the batch, so one unlicensed photograph never blocks a campaign.';

select cron.schedule('publish-scheduled-offerings', '*/10 * * * *',
  'select public.publish_scheduled_offerings();');

-- Walk upward, so a district page also shows inclusive offerings scoped to its
-- region or to the country. Defined before the function that calls it.
create or replace function public.place_descendants_up(p_slug text)
returns table (slug text) language sql stable security definer set search_path = '' as $fn$
  with recursive up as (
    select p_slug as slug
    union all
    select l.parent_slug from public.place_links l join up on up.slug = l.child_slug
    where l.link_type_slug = 'administrative'
  ) select slug from up;
$fn$;

create or replace function public.surface_offerings(
  p_surface text, p_place text default null, p_chapter text default null, p_limit integer default 20)
returns table (
  offering_id uuid, slug text, type text, title text, summary text, variant text, priority smallint,
  place_slug text, chapter_slug text, starts_at timestamptz, audience text,
  list_price numeric, list_currency text, perk_kind text, discount_percent smallint,
  hero_path text, hero_alt text, hero_credit text
) language sql stable security invoker set search_path = '' as $fn$
  select o.id, o.slug, o.type_slug, o.title, o.summary, s.variant, s.priority,
         o.place_slug, o.chapter_slug, o.starts_at, o.audience,
         o.list_price_amount, o.list_price_currency, k.perk_kind, k.discount_percent,
         m.storage_path, m.alt_text, m.credit
  from public.offerings o
  join public.offering_surfaces s on s.offering_id = o.id and s.surface_slug = p_surface
  left join public.offering_perks k on k.offering_id = o.id
  left join public.offering_media om on om.offering_id = o.id and om.role = 'hero'
  left join public.media_assets m on m.id = om.media_id
  where o.state = 'published'
    and (
      p_place is null
      or o.place_slug = p_place
      or (o.scope_mode = 'inclusive'
          and o.place_slug in (select u.slug from public.place_descendants_up(p_place) u))
    )
    and (p_chapter is null or o.chapter_slug = p_chapter)
  order by s.priority, o.starts_at nulls last, o.created_at desc
  limit greatest(1, least(coalesce(p_limit,20), 100));
$fn$;

comment on function public.surface_offerings(text,text,text,integer) is
  'What renders where. A district page calls it with its own slug and receives both offerings scoped to that district and inclusive offerings scoped to its region or the country.';

do $g$
begin
  execute 'revoke all on function public.publish_scheduled_offerings() from public, anon, authenticated';
  execute 'grant execute on function public.publish_scheduled_offerings() to service_role';
  execute 'grant execute on function public.surface_offerings(text,text,text,integer) to anon, authenticated, service_role';
  execute 'grant execute on function public.place_descendants_up(text) to anon, authenticated, service_role';
  execute 'revoke all on function public.offerings_default_surfaces() from public, anon, authenticated';
  execute 'revoke all on function public.offering_media_require_clearance() from public, anon, authenticated';
  execute 'revoke all on function public.offerings_block_publish_uncleared() from public, anon, authenticated';
end;
$g$;

alter table public.media_assets enable row level security;
alter table public.offering_media enable row level security;
alter table public.render_surfaces enable row level security;
alter table public.offering_surfaces enable row level security;
alter table public.media_assets force row level security;
alter table public.offering_media force row level security;
alter table public.render_surfaces force row level security;
alter table public.offering_surfaces force row level security;

revoke all on public.media_assets from anon, authenticated;
revoke all on public.offering_media from anon, authenticated;
revoke all on public.render_surfaces from anon, authenticated;
revoke all on public.offering_surfaces from anon, authenticated;
grant select on public.media_assets to anon, authenticated;
grant select on public.offering_media to anon, authenticated;
grant select on public.render_surfaces to anon, authenticated;
grant select on public.offering_surfaces to anon, authenticated;

create policy media_select_cleared on public.media_assets for select to anon, authenticated
  using (is_cleared);
create policy om_select on public.offering_media for select to anon, authenticated
  using (exists (select 1 from public.offerings o where o.id = offering_media.offering_id and o.state in ('published','closed')));
create policy rs_select on public.render_surfaces for select to anon, authenticated using (true);
create policy os_select on public.offering_surfaces for select to anon, authenticated
  using (exists (select 1 from public.offerings o where o.id = offering_surfaces.offering_id and o.state in ('published','closed')));
