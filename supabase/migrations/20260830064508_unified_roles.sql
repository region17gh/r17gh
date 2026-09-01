create table public.role_subject_kinds (
  slug        text primary key,
  name        text not null,
  source_table text not null,
  description text not null,
  sort_order  smallint not null unique
);

insert into public.role_subject_kinds (slug, name, source_table, description, sort_order) values
  ('place','Place','public.places','A country, region, district, traditional area or community.',1),
  ('chapter','Chapter','public.chapters','A diaspora-side chapter. Origins, where places are destinations.',2),
  ('organization','Organization','public.organizations','An organizational account. Table not yet built; roles of this kind are rejected until it exists.',3);

create table public.role_types (
  slug                  text primary key,
  name                  text not null,
  description           text not null,
  subject_kind          text not null references public.role_subject_kinds (slug) on update cascade on delete restrict,
  grants_need_submission boolean not null default false,
  requires_verification  boolean not null default true,
  sort_order            smallint not null unique,
  is_active             boolean not null default true,
  constraint role_types_slug_format check (slug ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$')
);

comment on column public.role_types.grants_need_submission is
  'Whether holding this role lets the member submit a need for the subject. This is the gate that moves a district from listed to partnered.';

insert into public.role_types (slug, name, description, subject_kind, grants_need_submission, sort_order) values
  ('regional-representative','Regional representative','Named by the Regional Coordinating Council to represent the region on the platform.','place',true,1),
  ('district-representative','District representative','Named by the district assembly. The counterparty who submits needs for the district.','place',true,2),
  ('traditional-liaison','Traditional liaison','Speaks for a traditional authority. Content they touch goes through cultural review.','place',false,3),
  ('chapter-lead','Chapter lead','Leads a diaspora chapter.','chapter',false,4),
  ('chapter-organizer','Chapter organizer','Organises for a diaspora chapter.','chapter',false,5),
  ('organization-admin','Organization administrator','Administers an organizational account and may submit needs on its behalf.','organization',true,6),
  ('organization-member','Organization member','Belongs to an organizational account.','organization',false,7);

create table public.roles (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.members (id) on delete restrict,
  role_slug     text not null references public.role_types (slug) on update cascade on delete restrict,
  subject_kind  text not null references public.role_subject_kinds (slug) on update cascade on delete restrict,
  subject_slug  text not null,
  state         text not null default 'active',
  granted_at    timestamptz not null default now(),
  granted_by    uuid references public.members (id) on delete restrict,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  revoked_by    uuid references public.members (id) on delete restrict,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint roles_state_value check (state in ('active','expired','revoked')),
  constraint roles_revoked_needs_timestamp check (state <> 'revoked' or revoked_at is not null),
  constraint roles_active_not_revoked check (state <> 'active' or revoked_at is null),
  constraint roles_expiry_after_grant check (expires_at is null or expires_at > granted_at)
);

comment on table public.roles is
  'One role system for every subject. Replaces chapter_roles and pre-empts separate systems for organizations and district representatives. member_id is ON DELETE RESTRICT, not CASCADE, because attribution is retained; erasure goes through pseudonymize_member, which keeps the row.';
comment on column public.roles.subject_slug is
  'Slug in the table named by role_subject_kinds.source_table. Not a foreign key, because the subject is polymorphic. Existence is enforced by trigger instead.';

create unique index roles_one_active_per_subject
  on public.roles (member_id, role_slug, subject_kind, subject_slug)
  where state = 'active';

create index roles_subject_idx on public.roles (subject_kind, subject_slug) where state = 'active';
create index roles_member_idx  on public.roles (member_id) where state = 'active';

create trigger roles_touch before update on public.roles
  for each row execute function public.touch_updated_at();

create or replace function public.roles_validate_subject()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_expected text;
begin
  select rt.subject_kind into v_expected
  from public.role_types rt where rt.slug = new.role_slug;

  if v_expected is distinct from new.subject_kind then
    raise exception 'role % applies to subject kind %, not %', new.role_slug, v_expected, new.subject_kind
      using errcode = 'check_violation';
  end if;

  if new.subject_kind = 'place' then
    if not exists (select 1 from public.places p where p.slug = new.subject_slug) then
      raise exception 'no place with slug %', new.subject_slug using errcode = 'foreign_key_violation';
    end if;
  elsif new.subject_kind = 'chapter' then
    if not exists (select 1 from public.chapters c where c.slug = new.subject_slug) then
      raise exception 'no chapter with slug %', new.subject_slug using errcode = 'foreign_key_violation';
    end if;
  elsif new.subject_kind = 'organization' then
    raise exception 'organization roles cannot be granted until public.organizations exists'
      using errcode = 'foreign_key_violation';
  else
    raise exception 'unknown subject kind %', new.subject_kind using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger roles_validate_subject_trg
  before insert or update of role_slug, subject_kind, subject_slug on public.roles
  for each row execute function public.roles_validate_subject();

comment on table public.chapter_roles is
  'SUPERSEDED by public.roles. Zero rows at supersession. Its member_id ON DELETE CASCADE contradicted the retained-attribution rule and is not carried forward. Drop in a later migration.';
revoke all on public.chapter_roles from anon, authenticated;

alter table public.role_subject_kinds enable row level security;
alter table public.role_types         enable row level security;
alter table public.roles              enable row level security;
alter table public.role_subject_kinds force row level security;
alter table public.role_types         force row level security;
alter table public.roles              force row level security;

revoke all on public.role_subject_kinds from anon, authenticated;
revoke all on public.role_types         from anon, authenticated;
revoke all on public.roles              from anon, authenticated;
grant select on public.role_subject_kinds to anon, authenticated;
grant select on public.role_types         to anon, authenticated;
grant select on public.roles              to anon, authenticated;

create policy rsk_select on public.role_subject_kinds for select to anon, authenticated using (true);
create policy rt_select  on public.role_types         for select to anon, authenticated using (is_active);

create policy roles_select_public
  on public.roles for select to anon, authenticated
  using (
    state = 'active'
    and subject_kind = 'place'
    and exists (select 1 from public.places p where p.slug = roles.subject_slug and p.is_published)
  );
