-- O-003. Official reference data and Region 17's own taxonomy, side by side in one table,
-- so a region page reads one row instead of joining a government fact to a Notion property.
--
-- ON THE BRONG AHAFO QUESTION. The Ministry of Foreign Affairs regions page
-- (mfa.gov.gh/index.php/about-ghana/regions/) lists "Brong Ahafo / Sunyani" in its table.
-- We are NOT adopting that name, for three reasons:
--   1. The map published on that same MFA page shows BONO and BONO EAST as separate
--      labelled regions and contains no Brong Ahafo. The page contradicts itself.
--   2. The MFA table still totals sixteen regions. So it is not claiming Brong Ahafo
--      exists alongside Bono; it is using the pre-2019 label for the same region.
--      A stale label on a correct list, not a different list.
--   3. The 27 December 2018 referendum divided Brong-Ahafo. Bono is the continuing
--      region, keeping Sunyani; Bono East and Ahafo were carved out of it.
-- Rather than argue about which page is right, former_name makes the old label
-- resolvable: a search or an import for "Brong Ahafo" finds Bono, while every surface
-- displays the current name.

alter table public.ghana_regions
  add column if not exists former_name        text,
  add column if not exists created_2018_from  text,
  add column if not exists band               text,
  add column if not exists pattern            smallint,
  add column if not exists ink_token          text,
  add column if not exists fill_token         text,
  add column if not exists data_confidence    text,
  add column if not exists reference_source   text,
  add column if not exists reference_verified date;

update public.ghana_regions g set
  former_name       = v.former_name,
  created_2018_from = v.created_from,
  band              = v.band,
  pattern           = v.pattern,
  ink_token         = '--region-' || g.slug,
  fill_token        = '--region-' || g.slug || '-fill',
  data_confidence   = v.confidence,
  reference_source  = 'Ministry of Foreign Affairs, Ghana (mfa.gov.gh), cross-checked against the 2018 referendum outcome',
  reference_verified = date '2026-08-27'
from (values
  ('ahafo',         null,           'Brong Ahafo', 'Forest',      3, 'Parent-region'),
  ('ashanti',       null,           null,          'Forest',      1, 'Estimate'),
  ('bono',          'Brong Ahafo',  null,          'Middle belt', 4, 'Parent-region'),
  ('bono-east',     null,           'Brong Ahafo', 'Middle belt', 2, 'Parent-region'),
  ('central',       null,           null,          'Coast',       2, 'Estimate'),
  ('eastern',       null,           null,          'Forest',      3, 'Estimate'),
  ('greater-accra', null,           null,          'Coast',       1, 'Estimate'),
  ('north-east',    null,           'Northern',    'North',       2, 'Parent-region'),
  ('northern',      null,           null,          'North',       3, 'Parent-region'),
  ('oti',           null,           'Volta',       'Middle belt', 4, 'Parent-region'),
  ('savannah',      null,           'Northern',    'North',       1, 'Parent-region'),
  ('upper-east',    null,           null,          'North',       1, 'Estimate'),
  ('upper-west',    null,           null,          'North',       3, 'Estimate'),
  ('volta',         null,           null,          'Coast',       2, 'Estimate'),
  ('western',       null,           null,          'Coast',       3, 'Estimate'),
  ('western-north', null,           'Western',     'Forest',      2, 'Parent-region')
) as v(slug, former_name, created_from, band, pattern, confidence)
where g.slug = v.slug;

comment on column public.ghana_regions.former_name is
  'Pre-2019 name, where the region was renamed rather than created. Bono was Brong Ahafo. Present so that stale sources, including the Ministry of Foreign Affairs regions table, can be resolved to the current region instead of reintroducing the old label.';

comment on column public.ghana_regions.created_2018_from is
  'Parent region, for the six created by the 27 December 2018 referendum: Savannah and North East from Northern, Oti from Volta, Bono East and Ahafo from Brong-Ahafo, Western North from Western. This is what makes data_confidence = Parent-region meaningful.';

comment on column public.ghana_regions.band is
  'Region 17 latitudinal taxonomy: Coast, Forest, Middle belt, North. NOT a Ghanaian government classification. Ours, and still pending a Ghanaian sense-check under O-003.';

comment on column public.ghana_regions.data_confidence is
  'Estimate, or Parent-region where figures may still describe the pre-2018 parent rather than the region as it exists now. Per the standing rule that every figure carries source, year and confidence.';
