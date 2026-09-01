-- A platform operator is a member holding an active role on Ghana. Console
-- access is therefore attributable to a person, not to a shared service key,
-- and revoking it is one row.
insert into public.role_types (slug, name, description, subject_kind, grants_need_submission, sort_order)
values ('platform-operator','Platform operator',
        'Region 17 staff. Scoped to the Ghana place, so the administrative chain grants submission everywhere.',
        'place', true, 8);

create or replace function public.is_operator()
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from public.roles r
    where r.member_id = public.current_member_id()
      and r.state = 'active'
      and r.role_slug = 'platform-operator'
      and r.subject_kind = 'place'
      and r.subject_slug = 'ghana'
  );
$fn$;

-- ---------------------------------------------------------------------------
-- 1. the response queue: what Region 17 owes an answer on, worst first
-- ---------------------------------------------------------------------------

create or replace function public.ops_response_queue(p_limit integer default 100)
returns table (
  engagement_id uuid, title text, place_name text, place_slug text,
  state text, opened_at timestamptz, review_due_at timestamptz,
  hours_overdue numeric, participants bigint, unsolicited boolean
) language sql stable security definer set search_path = '' as $fn$
  select e.id, e.title, p.name, e.place_slug, e.state, e.opened_at, e.review_due_at,
         round(extract(epoch from (now() - e.review_due_at)) / 3600.0, 1),
         (select count(*) from public.engagement_participants ep
           where ep.engagement_id = e.id and ep.left_at is null),
         e.need_id is null
  from public.engagements e
  join public.places p on p.slug = e.place_slug
  where public.is_operator()
    and e.state in ('expressed','in-review')
  order by e.review_due_at
  limit greatest(1, least(coalesce(p_limit,100), 500));
$fn$;

comment on function public.ops_response_queue(integer) is
  'The single most important screen in the console. An engagement sitting past its due date is the failure most likely to cost trust, and hours_overdue goes negative for anything still inside its window.';

-- ---------------------------------------------------------------------------
-- 2. campaign board: where all sixteen regions stand
-- ---------------------------------------------------------------------------

create or replace function public.ops_campaign_board()
returns table (
  region_slug text, region_name text, band text, depth text,
  districts bigint, districts_partnered bigint, districts_profiled bigint,
  priority_sectors bigint, published_postings bigint,
  watchers bigint, declarations bigint, engagements bigint,
  representatives bigint, last_activity timestamptz
) language sql stable security definer set search_path = '' as $fn$
  select r.slug, r.name, g.band, r.depth_slug,
    (select count(*) from public.places d
      join public.place_links l on l.child_slug = d.slug and l.link_type_slug='administrative'
      where l.parent_slug = r.slug and d.type_slug='district'),
    (select count(*) from public.places d
      join public.place_links l on l.child_slug = d.slug and l.link_type_slug='administrative'
      where l.parent_slug = r.slug and d.type_slug='district' and d.depth_slug='partnered'),
    (select count(*) from public.places d
      join public.place_links l on l.child_slug = d.slug and l.link_type_slug='administrative'
      where l.parent_slug = r.slug and d.type_slug='district' and d.depth_slug='profiled'),
    (select count(*) from public.region_priority_sectors rps where rps.place_slug = r.slug),
    (select count(*) from public.needs n
      where n.state='published' and n.place_slug in (select slug from public.place_descendants(r.slug))),
    (select count(*) from public.subscriptions s
      where s.subject_kind='place' and s.state='active'
        and s.subject_id in (select slug from public.place_descendants(r.slug))),
    (select count(*) from public.declarations d
      where d.state='active' and d.place_slug in (select slug from public.place_descendants(r.slug))),
    (select count(*) from public.engagements e
      where e.place_slug in (select slug from public.place_descendants(r.slug))),
    (select count(*) from public.roles ro
      where ro.state='active' and ro.subject_kind='place'
        and ro.role_slug in ('regional-representative','district-representative')
        and ro.subject_slug in (select slug from public.place_descendants(r.slug))),
    (select max(a.occurred_at) from public.activity_events a
      where a.place_slug in (select slug from public.place_descendants(r.slug)))
  from public.places r
  join public.ghana_regions g on g.slug = r.slug
  where public.is_operator() and r.type_slug = 'region'
  order by g.sort_order;
$fn$;

comment on function public.ops_campaign_board() is
  'Campaign progress is a database fact, not a spreadsheet. A district reaching partnered means an assembly named a representative who can post for themselves.';

-- ---------------------------------------------------------------------------
-- 3. publication queue: submitted postings awaiting Region 17
-- ---------------------------------------------------------------------------

create or replace function public.ops_publication_queue()
returns table (
  need_id uuid, title text, direction text, place_name text, place_slug text,
  sector text, status text, submitted_at timestamptz, days_waiting numeric,
  data_confidence text, reference_source text, review_flag text
) language sql stable security definer set search_path = '' as $fn$
  select n.id, n.title, n.direction, p.name, n.place_slug, n.sector_slug, n.status_slug,
         n.submitted_at, round(extract(epoch from (now() - n.submitted_at)) / 86400.0, 1),
         n.data_confidence, n.reference_source, n.review_flag
  from public.needs n
  join public.places p on p.slug = n.place_slug
  where public.is_operator() and n.state in ('draft','submitted')
  order by n.submitted_at;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. recruitment: who can do this, where
-- ---------------------------------------------------------------------------

create or replace function public.ops_recruit(
  p_place text,
  p_direction text default 'offer',
  p_pathway text default null,
  p_sector text default null,
  p_limit integer default 200
) returns table (
  member_id uuid, display_name text, declaration_id uuid, headline text,
  pathway text, sector text, declared_place text, capacity_note text,
  available_until date, visibility text
) language sql stable security definer set search_path = '' as $fn$
  select d.member_id,
         coalesce(nullif(btrim(m.display_name),''), 'Member ' || m.member_number::text),
         d.id, d.headline, d.pathway_slug, d.sector_slug, d.place_slug,
         d.capacity_note, d.available_until, d.visibility
  from public.declarations d
  join public.members m on m.id = d.member_id
  where public.is_operator()
    and d.state = 'active'
    and d.available_until >= current_date
    and d.direction = p_direction
    and public.places_on_same_chain(d.place_slug, p_place)
    and (p_pathway is null or d.pathway_slug = p_pathway)
    and (p_sector is null or d.sector_slug is null or d.sector_slug = p_sector)
  order by
    case when d.place_slug = p_place then 0 else 1 end,
    case when d.sector_slug = p_sector then 0 else 1 end,
    d.created_at desc
  limit greatest(1, least(coalesce(p_limit,200), 1000));
$fn$;

comment on function public.ops_recruit(text,text,text,text,integer) is
  'The query that makes convening possible at speed. Finding thirty-five tech investors for Greater Accra is one indexed lookup, not a month of asking around. Private declarations appear here because matching is a stated consent purpose; the visibility column tells the operator what may be shown publicly.';

-- ---------------------------------------------------------------------------
-- 5. data quality: the punch list
-- ---------------------------------------------------------------------------

create or replace function public.ops_data_quality()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select case when not public.is_operator() then null else jsonb_build_object(
    'places_conflicted', (select count(*) from public.places where data_confidence='Conflicted'),
    'places_unsourced', (select count(*) from public.places where reference_source is null),
    'districts_without_capital', (select count(*) from public.places where type_slug='district' and capital is null),
    'districts_without_zone', (select count(*) from public.places where type_slug='district' and zone is null),
    'traditional_areas_pending_review', (select count(*) from public.places
       where type_slug='traditional-area' and cultural_review_at is null),
    'regions_without_priority_sectors', (select count(*) from public.places r
       where r.type_slug='region'
         and not exists (select 1 from public.region_priority_sectors x where x.place_slug = r.slug)),
    'priority_sectors_unconfirmed', (select count(*) from public.region_priority_sectors where declared_by is null),
    'needs_conflicted', (select count(*) from public.needs where data_confidence='Conflicted'),
    'needs_without_pathways', (select count(*) from public.needs n where n.state='published'
       and not exists (select 1 from public.need_pathways np where np.need_id = n.id))
  ) end;
$fn$;

comment on function public.ops_data_quality() is
  'The Volta punch list generalised to 261 districts. Every number here is a task, and a Conflicted row is one that cannot reach a public page until someone resolves it.';

-- ---------------------------------------------------------------------------
-- 6. health: is the engine actually running
-- ---------------------------------------------------------------------------

create or replace function public.ops_health()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select case when not public.is_operator() then null else jsonb_build_object(
    'engagements_overdue', (select count(*) from public.engagements
       where state in ('expressed','in-review') and review_due_at < now()),
    'postings_awaiting_publication', (select count(*) from public.needs where state in ('draft','submitted')),
    'published_postings_with_no_match', (select count(*) from public.needs n where n.state='published'
       and not exists (select 1 from public.matches mm where mm.need_id = n.id)),
    'declarations_lapsing_30d', (select count(*) from public.declarations
       where state='active' and available_until < current_date + 30),
    'deliveries_queued', (select count(*) from public.notification_deliveries where state='queued'),
    'deliveries_failed', (select count(*) from public.notification_deliveries where state='failed'),
    'deliveries_stuck_claimed', (select count(*) from public.notification_deliveries
       where state='claimed' and claimed_at < now() - interval '30 minutes'),
    'suppressed_addresses', (select count(*) from public.email_suppressions),
    'reports_open', (select count(*) from public.reports where state in ('open','reviewing')),
    'last_activity_at', (select max(occurred_at) from public.activity_events)
  ) end;
$fn$;

comment on function public.ops_health() is
  'deliveries_stuck_claimed is the canary: rows claimed but never marked sent mean the edge function is dying mid-batch. published_postings_with_no_match means the register is too thin for that posting, which is a recruitment task, not a bug.';

do $g$
declare f text;
begin
  foreach f in array array[
    'public.ops_response_queue(integer)',
    'public.ops_campaign_board()',
    'public.ops_publication_queue()',
    'public.ops_recruit(text,text,text,text,integer)',
    'public.ops_data_quality()',
    'public.ops_health()',
    'public.is_operator()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$g$;
