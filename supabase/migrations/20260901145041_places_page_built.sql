-- places.page_built — whether a place's own page exists and is safe to link to.
--
-- Deliberately NOT depth_slug, and never derived from it. Depth is how far
-- Region 17 has got with the place itself: listed, profiled, partnered.
-- page_built is whether the page a reader would be sent to exists. A partnered
-- place can have no page yet; a listed one can have a page written for it.
-- Two independent facts, kept apart on purpose.
--
-- Defaults false, which is the truthful state for all 280 places today: no
-- route serves a place path yet. The Volta region page reads this through
-- region_payload and shows its not-yet-built state for every district.
--
-- No new write grant. `places` is SELECT-only for anon and authenticated and
-- stays that way; page_built is flipped as service_role, by hand, the same way
-- every other one-off edit to this table already happens. A named setter
-- belongs to the operations console when that exists, not shipped standalone
-- ahead of the thing that would call it.

alter table public.places
  add column if not exists page_built boolean not null default false;

comment on column public.places.page_built is
  'Whether this place''s own page is built and safe to navigate to. Independent of depth_slug: a partnered place can have no page, and a listed one can have a page written for it. Never infer either from the other. Do not set true before a route actually serves the place''s url_path, or every reader who follows the link gets a 404.';

-- region_payload: emit page_built per district. Additive, so the only other
-- change is the contract string, which the client already accepts at /2 or /3
-- and reads an absent page_built as false.

create or replace function public.region_payload(p_slug text)
 returns jsonb
 language sql
 stable
 set search_path to ''
as $function$
  select jsonb_build_object(
    'contract', 'region-payload/3',
    'generated_at', now(),
    'region', (
      select jsonb_build_object(
        'slug', p.slug,
        'name', p.name,
        'capital', p.capital,
        'url_path', p.url_path,
        'band', p.zone,
        'depth', p.depth_slug,
        'ink_token', g.ink_token,
        'fill_token', g.fill_token,
        'pattern', g.pattern,
        'sort_order', g.sort_order,
        'former_name', g.former_name,
        'created_2018_from', g.created_2018_from,
        'data_confidence', p.data_confidence,
        'reference_source', p.reference_source,
        'reference_verified', p.reference_verified
      )
      from public.places p
      join public.ghana_regions g on g.slug = p.slug
      where p.slug = p_slug and p.type_slug = 'region'
    ),
    'zones', coalesce((
      select jsonb_agg(z order by z->>'slug')
      from (
        select jsonb_build_object(
          'slug', d.zone,
          'district_count', count(*)
        ) as z
        from public.places d
        join public.place_links l
          on l.child_slug = d.slug and l.link_type_slug = 'administrative'
        where l.parent_slug = p_slug and d.type_slug = 'district' and d.zone is not null
        group by d.zone
      ) s
    ), '[]'::jsonb),
    'districts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', d.slug,
        'name', d.name,
        'capital', d.capital,
        'zone', d.zone,
        'url_path', d.url_path,
        'summary', d.summary,
        'depth', d.depth_slug,
        'page_built', d.page_built,
        'data_confidence', d.data_confidence,
        'reference_source', d.reference_source,
        'reference_verified', d.reference_verified
      ) order by d.zone nulls last, d.name)
      from public.places d
      join public.place_links l
        on l.child_slug = d.slug and l.link_type_slug = 'administrative'
      where l.parent_slug = p_slug and d.type_slug = 'district'
    ), '[]'::jsonb),
    'priority_sectors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', r.rank,
        'sector_slug', s.slug,
        'sector_name', s.name,
        'note', r.note,
        'data_confidence', r.data_confidence,
        'reference_source', r.reference_source,
        'reference_verified', r.reference_verified,
        'declared_by', r.declared_by
      ) order by r.rank)
      from public.region_priority_sectors r
      join public.sectors s on s.slug = r.sector_slug
      where r.place_slug = p_slug
    ), '[]'::jsonb),
    'pathways', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', pw.slug, 'name', pw.name,
        'offer_label', pw.offer_label, 'seek_label', pw.seek_label
      ) order by pw.sort_order)
      from public.pathways pw where pw.is_active
    ), '[]'::jsonb),
    'facts', '[]'::jsonb,
    'needs', '[]'::jsonb,
    'constraints', '[]'::jsonb,
    'timeline', '[]'::jsonb,
    'activity', 'null'::jsonb,
    'not_yet_backed', jsonb_build_array(
      'facts: no facts table exists. Population and land area are conflicted and unresolved.',
      'needs: needs table not built. Render the module empty, not with placeholder rows.',
      'constraints: no constraints table exists.',
      'timeline: no timeline table exists.',
      'activity: subscriptions, declarations and engagements not built. No counts are real.'
    )
  );
$function$;
