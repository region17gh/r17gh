create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members (id) on delete restrict,
  kind         text not null,
  subject_kind text not null,
  subject_id   text not null,
  title        text not null,
  body         text,
  url_path     text,
  state        text not null default 'unread',
  emailed_at   timestamptz,
  read_at      timestamptz,
  dismissed_at timestamptz,
  created_at   timestamptz not null default now(),
  constraint notifications_state_value check (state in ('unread','read','dismissed')),
  constraint notifications_title_length check (length(btrim(title)) between 3 and 200)
);

comment on table public.notifications is
  'The mechanism that makes the platform move first. Every other surface waits to be visited; this one reaches the member. Without it the DMP is a well-sourced directory.';

create index notifications_member_idx on public.notifications (member_id, state, created_at desc);
create index notifications_unsent_idx on public.notifications (created_at) where emailed_at is null;

create table public.matches (
  id             uuid primary key default gen_random_uuid(),
  need_id        uuid not null references public.needs (id) on delete cascade,
  declaration_id uuid not null references public.declarations (id) on delete cascade,
  member_id      uuid not null references public.members (id) on delete restrict,
  score          smallint not null,
  reasons        text[] not null default '{}',
  state          text not null default 'new',
  notified_at    timestamptz,
  viewed_at      timestamptz,
  dismissed_at   timestamptz,
  created_at     timestamptz not null default now(),
  constraint matches_state_value check (state in ('new','notified','viewed','acted','dismissed','stale')),
  constraint matches_score_range check (score between 1 and 10)
);

comment on table public.matches is
  'A generated pairing of a place posting and a member declaration. Recorded rather than computed on the fly so a member is told once, can dismiss, and is never told twice.';
comment on column public.matches.reasons is
  'Why this matched, in plain language. A member who cannot see why will not trust the match, and the whole product rests on showing its working.';

create unique index matches_pair_key on public.matches (need_id, declaration_id);
create index matches_member_idx on public.matches (member_id, state);

-- Two places match if one contains the other administratively, or they are the same.
create or replace function public.places_on_same_chain(a text, b text)
returns boolean language sql stable security definer set search_path = '' as $fn$
  with recursive up_a as (
    select a as slug
    union all
    select l.parent_slug from public.place_links l join up_a on up_a.slug = l.child_slug
    where l.link_type_slug = 'administrative'
  ), up_b as (
    select b as slug
    union all
    select l.parent_slug from public.place_links l join up_b on up_b.slug = l.child_slug
    where l.link_type_slug = 'administrative'
  )
  select exists (select 1 from up_a where slug = b)
      or exists (select 1 from up_b where slug = a);
$fn$;

-- Candidate declarations for a published posting, with score and stated reasons.
create or replace function public.match_candidates_for_need(p_need uuid)
returns table (declaration_id uuid, member_id uuid, score smallint, reasons text[])
language sql stable security definer set search_path = '' as $fn$
  select d.id,
         d.member_id,
         (
           case when d.place_slug = n.place_slug then 3 else 2 end
           + case when d.sector_slug is not null and d.sector_slug = n.sector_slug then 2
                  when d.sector_slug is null or n.sector_slug is null then 1
                  else 0 end
           + case when exists (
                    select 1 from public.need_pathways np
                    where np.need_id = n.id and np.pathway_slug = d.pathway_slug
                  ) or not exists (select 1 from public.need_pathways np2 where np2.need_id = n.id)
                  then 2 else 0 end
         )::smallint,
         array_remove(array[
           case when d.place_slug = n.place_slug then 'same place'
                else 'place overlaps: ' || d.place_slug || ' and ' || n.place_slug end,
           case when d.sector_slug is not null and d.sector_slug = n.sector_slug then 'sector: ' || d.sector_slug
                when d.sector_slug is null then 'declared across all sectors'
                when n.sector_slug is null then 'posting spans sectors'
                else null end,
           case when exists (select 1 from public.need_pathways np where np.need_id = n.id and np.pathway_slug = d.pathway_slug)
                then 'pathway: ' || d.pathway_slug else null end
         ], null)
  from public.needs n
  join public.declarations d
    on d.state = 'active'
   and d.available_until >= current_date
   and d.direction <> n.direction
   and public.places_on_same_chain(d.place_slug, n.place_slug)
   and (d.sector_slug is null or n.sector_slug is null or d.sector_slug = n.sector_slug)
   and (
        not exists (select 1 from public.need_pathways np2 where np2.need_id = n.id)
        or exists (select 1 from public.need_pathways np3 where np3.need_id = n.id and np3.pathway_slug = d.pathway_slug)
       )
  where n.id = p_need and n.state = 'published';
$fn$;

create or replace function public.generate_matches_for_need(p_need uuid)
returns integer language plpgsql security definer set search_path = '' as $fn$
declare v_count integer := 0; r record; n record;
begin
  select id, title, place_slug, direction into n from public.needs where id = p_need and state = 'published';
  if n.id is null then return 0; end if;

  for r in select * from public.match_candidates_for_need(p_need) loop
    begin
      insert into public.matches (need_id, declaration_id, member_id, score, reasons)
      values (p_need, r.declaration_id, r.member_id, least(r.score, 10), r.reasons);

      insert into public.notifications (member_id, kind, subject_kind, subject_id, title, body, url_path)
      select r.member_id, 'match', 'need', p_need::text,
             case when n.direction = 'seek'
                  then p.name || ' is asking for something you offered'
                  else p.name || ' is offering something you were looking for' end,
             n.title,
             p.url_path
      from public.places p where p.slug = n.place_slug;

      v_count := v_count + 1;
    exception when unique_violation then null;
    end;
  end loop;
  return v_count;
end;
$fn$;

create or replace function public.generate_matches_for_declaration(p_decl uuid)
returns integer language plpgsql security definer set search_path = '' as $fn$
declare v_count integer := 0; r record;
begin
  for r in
    select n.id as need_id
    from public.declarations d
    join public.needs n
      on n.state = 'published'
     and n.direction <> d.direction
     and public.places_on_same_chain(d.place_slug, n.place_slug)
     and (d.sector_slug is null or n.sector_slug is null or d.sector_slug = n.sector_slug)
    where d.id = p_decl and d.state = 'active' and d.available_until >= current_date
  loop
    v_count := v_count + public.generate_matches_for_need(r.need_id);
  end loop;
  return v_count;
end;
$fn$;

comment on function public.generate_matches_for_need(uuid) is
  'Idempotent. The unique index on (need_id, declaration_id) means a member is told once and never told twice, even if this runs repeatedly.';

-- Fire on publication and on new declarations. This is what makes it real-time rather than a batch job.
create or replace function public.needs_matching_trg()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.state = 'published' and (old.state is distinct from 'published') then
    perform public.generate_matches_for_need(new.id);
  end if;
  return new;
end;
$fn$;

create trigger needs_publish_matching
  after update of state on public.needs
  for each row execute function public.needs_matching_trg();

create or replace function public.declarations_matching_trg()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.state = 'active' then
    perform public.generate_matches_for_declaration(new.id);
  end if;
  return new;
end;
$fn$;

create trigger declarations_insert_matching
  after insert on public.declarations
  for each row execute function public.declarations_matching_trg();

alter table public.notifications enable row level security;
alter table public.matches enable row level security;
alter table public.notifications force row level security;
alter table public.matches force row level security;

revoke all on public.notifications from anon, authenticated;
revoke all on public.matches from anon, authenticated;
grant select, update on public.notifications to authenticated;
grant select, update on public.matches to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated using (member_id = public.current_member_id());
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id());

create policy matches_select_own on public.matches
  for select to authenticated using (member_id = public.current_member_id());
create policy matches_update_own on public.matches
  for update to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id());
