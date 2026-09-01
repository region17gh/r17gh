create or replace function public.region_payload(p_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'contract', 'region-payload/2',
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
$$;

comment on function public.region_payload(text) is
  'Single source for the region page contract. Runs security invoker so RLS applies: an unpublished or Conflicted place is invisible to anon and authenticated exactly as it is on the page. Keys under not_yet_backed have no table behind them yet and must render as empty, never as placeholder data.';

grant execute on function public.region_payload(text) to anon, authenticated;
