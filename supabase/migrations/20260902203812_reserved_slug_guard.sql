-- 20260902203812_reserved_slug_guard.sql
--
-- STATUS: ALREADY APPLIED to production idmxottsjqeiatgiudvt on 2026-09-02,
-- recorded in supabase_migrations.schema_migrations as version 20260902203812.
-- This file exists to restore repo/production parity for drift-detection CI.
-- It is idempotent (create table if not exists, drop constraint if exists,
-- on conflict do nothing, create or replace, drop trigger if exists), so a
-- replay is safe, but it does not need to be replayed.
--
-- D-078: URL architecture is default-locale-at-root with a flat place namespace.
-- English is served unprefixed (r17gh.com/volta, r17gh.com/volta/adaklu) and resolves
-- internally to the `en` locale. Non-default languages are prefixed (/fr/volta).
--
-- Because place slugs now share the top-level URL namespace with static application
-- routes, a collision between a place slug and a route segment is a live failure mode.
-- This migration closes it structurally in the database rather than by convention.
--
-- PRE-FLIGHT AUDIT (run against production idmxottsjqeiatgiudvt on 2026-09-02, before
-- this file was authored):
--     places total .......................... 280
--     slugs colliding with a reserved word ... 0
--     slugs failing the slug format regex .... 0
--     slugs shorter than 3 characters ........ 0
-- Both CHECK constraints therefore validate without any data fix.
--
-- NOTE: `ghana` is intentionally NOT reserved. It is a real country row in public.places
-- occupying r17gh.com/ghana. Do not add it to reserved_slugs.

begin;

-- ---------------------------------------------------------------------------
-- 1. The reserved namespace
-- ---------------------------------------------------------------------------

create table if not exists public.reserved_slugs (
  word       text        not null primary key,
  reason     text        not null,
  created_at timestamptz not null default now(),
  constraint reserved_slugs_word_format_chk
    check (word ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint reserved_slugs_word_lowercase_chk
    check (word = lower(word))
);

comment on table public.reserved_slugs is
  'D-078. Top-level URL segments that may never be used as a public.places slug. '
  'Enforced bidirectionally by places_reject_reserved_slug and '
  'reserved_slugs_reject_used. Reference data, world-readable, service_role-writable.';

comment on column public.reserved_slugs.reason is
  'Why the word is held: the route or route family that owns it.';

alter table public.reserved_slugs enable row level security;

-- Reference data with no member content. Readable by everyone so the trigger
-- function resolves under any role; writable only by service_role, which
-- bypasses RLS. Deliberately no insert/update/delete policy exists.
drop policy if exists reserved_slugs_read on public.reserved_slugs;
create policy reserved_slugs_read
  on public.reserved_slugs
  for select
  to anon, authenticated
  using (true);

grant select on public.reserved_slugs to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Seed
-- ---------------------------------------------------------------------------

insert into public.reserved_slugs (word, reason) values
  ('about',          'Institutional page'),
  ('account',        'Authenticated member surface'),
  ('admin',          'Administrative surface'),
  ('api',            'Server route namespace'),
  ('assets',         'Static asset namespace'),
  ('auth',           'Authentication route namespace'),
  ('blog',           'Editorial surface'),
  ('callback',       'OAuth and OTP return path'),
  ('chapters',       'R17GH Global Diaspora Chapters surface'),
  ('contact',        'Institutional page'),
  ('dashboard',      'Authenticated member surface'),
  ('directory',      'Member registry surface'),
  ('docs',           'Documentation surface'),
  ('events',         'Homepage nav item'),
  ('explore',        'Region page tab'),
  ('faq',            'Institutional page'),
  ('feed',           'Member activity surface'),
  ('fonts',          'Static asset namespace'),
  ('forgot',         'Account recovery path'),
  ('help',           'Support surface'),
  ('images',         'Static asset namespace'),
  ('join',           'D-067 charter funnel entry'),
  ('legal',          'Policy document namespace'),
  ('login',          'Reserved alias of signin'),
  ('logout',         'Reserved alias of signout'),
  ('media',          'Press and media asset surface'),
  ('member',         'Authenticated member surface'),
  ('members',        'Authenticated member surface'),
  ('needs',          'Region page tab'),
  ('news',           'Editorial surface'),
  ('onboarding',     'Post-registration flow'),
  ('opportunities',  'Opportunity surface'),
  ('partners',       'Reserved alias of partnerships'),
  ('partnerships',   'Homepage nav item'),
  ('perks',          'PERKS surface'),
  ('press',          'Press surface'),
  ('pricing',        'Commercial surface'),
  ('privacy',        'Policy document'),
  ('profile',        'Authenticated member surface'),
  ('programs',       'Homepage nav item'),
  ('public',         'Framework-reserved path'),
  ('recover',        'Account recovery path'),
  ('register',       'D-067 charter funnel registration'),
  ('regions',        'Region index surface'),
  ('reset',          'Account recovery path'),
  ('resources',      'Homepage nav item'),
  ('robots',         'Crawler control file'),
  ('rss',            'Syndication path'),
  ('search',         'Search surface'),
  ('services',       'Homepage nav item'),
  ('settings',       'Authenticated member surface'),
  ('signin',         'Existing auth route'),
  ('signout',        'Existing auth route'),
  ('signup',         'Reserved alias of register'),
  ('sitemap',        'Crawler index file'),
  ('skills',         'Skills Exchange surface'),
  ('static',         'Static asset namespace'),
  ('stories',        'Editorial surface'),
  ('support',        'Support surface'),
  ('terms',          'Policy document'),
  ('verified',       'Region 17 Verified credential surface'),
  ('verify',         'Existing auth route'),
  ('www',            'Hostname collision guard'),
  ('aka',            'ISO 639-3 Akan, future locale prefix'),
  ('ewe',            'ISO 639-3 Ewe, future locale prefix'),
  ('twi',            'ISO 639-3 Twi, future locale prefix'),
  ('hau',            'ISO 639-3 Hausa, future locale prefix'),
  ('swa',            'ISO 639-3 Swahili, future locale prefix'),
  ('yor',            'ISO 639-3 Yoruba, future locale prefix')
on conflict (word) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Slug shape constraints on places
-- ---------------------------------------------------------------------------

-- Lowercase kebab only. Prevents uppercase, underscores, spaces, and any path
-- separator from ever entering a URL segment.
alter table public.places
  drop constraint if exists places_slug_format_chk;
alter table public.places
  add constraint places_slug_format_chk
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Minimum length 3 makes it impossible for a place slug to shadow a two-letter
-- ISO 639-1 locale prefix, which keeps /fr, /pt, /es, /ar permanently available
-- for D-078's prefixed non-default locales.
alter table public.places
  drop constraint if exists places_slug_min_length_chk;
alter table public.places
  add constraint places_slug_min_length_chk
  check (char_length(slug) >= 3);

-- ---------------------------------------------------------------------------
-- 4. Bidirectional enforcement
-- ---------------------------------------------------------------------------

create or replace function public.trg_places_reject_reserved_slug()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.reserved_slugs r where r.word = lower(new.slug)
  ) then
    raise exception
      'place slug "%" is a reserved URL segment under D-078', new.slug
      using errcode = '23514',
            hint = 'Choose a different slug, or remove the word from '
                   'public.reserved_slugs if that route no longer exists.';
  end if;
  return new;
end;
$$;

comment on function public.trg_places_reject_reserved_slug() is
  'D-078. Blocks a place slug that would collide with a static route segment.';

drop trigger if exists places_reject_reserved_slug on public.places;
create trigger places_reject_reserved_slug
  before insert or update of slug on public.places
  for each row execute function public.trg_places_reject_reserved_slug();

-- The other direction: a route word cannot be reserved once a live place
-- already occupies it. Without this half, the guard is only enforced against
-- whichever side happens to be written second.
create or replace function public.trg_reserved_slugs_reject_used()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  conflicting text;
begin
  select p.slug into conflicting
  from public.places p
  where lower(p.slug) = new.word
  limit 1;

  if conflicting is not null then
    raise exception
      'cannot reserve "%": a live place already occupies that slug', new.word
      using errcode = '23514',
            hint = 'Rename or retire the place first, then reserve the word.';
  end if;
  return new;
end;
$$;

comment on function public.trg_reserved_slugs_reject_used() is
  'D-078. Blocks reserving a word that a live place slug already occupies.';

drop trigger if exists reserved_slugs_reject_used on public.reserved_slugs;
create trigger reserved_slugs_reject_used
  before insert or update of word on public.reserved_slugs
  for each row execute function public.trg_reserved_slugs_reject_used();

commit;
