create table public.data_confidence_levels (
  label       text primary key,
  description text not null,
  publishable boolean not null,
  sort_order  smallint not null unique
);

comment on table public.data_confidence_levels is
  'Closed vocabulary for data_confidence across the schema. Values Estimate and Parent-region were already in use in ghana_regions; Sourced and Conflicted are added for region and district pages.';

insert into public.data_confidence_levels (label, description, publishable, sort_order) values
  ('Sourced',       'Confirmed against a named primary or official source.', true, 1),
  ('Estimate',      'Derived or approximate. Publishable with hedged framing.', true, 2),
  ('Parent-region', 'Figure belongs to the pre-2018 parent region, not the current boundary. Publishable only where the distinction is stated.', true, 3),
  ('Conflicted',    'Sources disagree. Must not be published until resolved.', false, 4);

alter table public.ghana_regions
  add constraint ghana_regions_data_confidence_fkey
  foreign key (data_confidence) references public.data_confidence_levels (label)
  on update cascade on delete restrict;

create table public.sectors (
  slug        text primary key,
  name        text not null,
  description text not null,
  sort_order  smallint not null unique,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint sectors_slug_format check (slug ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  constraint sectors_name_not_blank check (length(btrim(name)) > 0)
);

comment on table public.sectors is
  'Fixed sector vocabulary aligned to GIPC priority sectors and the 24H+ programme. Needs, declarations and region priorities all reference it by slug.';

create table public.pathways (
  slug        text primary key,
  name        text not null,
  description text not null,
  offer_label text not null,
  seek_label  text not null,
  sort_order  smallint not null unique,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint pathways_slug_format check (slug ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$')
);

comment on table public.pathways is
  'The six ways a member or organisation engages. Every pathway is bidirectional so continental and diaspora members are symmetric.';

create table public.opportunity_tags (
  slug        text primary key,
  name        text not null,
  description text not null,
  sort_order  smallint not null unique,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint opportunity_tags_slug_format check (slug ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$')
);

comment on table public.opportunity_tags is
  'Cross-cutting properties of a need, including the eight 24H+ sub-programmes.';

create trigger sectors_touch          before update on public.sectors          for each row execute function public.touch_updated_at();
create trigger pathways_touch         before update on public.pathways         for each row execute function public.touch_updated_at();
create trigger opportunity_tags_touch before update on public.opportunity_tags for each row execute function public.touch_updated_at();

insert into public.sectors (slug, name, description, sort_order) values
  ('agribusiness','Agribusiness','Farming, agro-processing, cold chain, irrigation and climate-smart agriculture.',1),
  ('manufacturing','Manufacturing','Light industry, value addition, industrial parks and local production of imported goods.',2),
  ('energy','Energy','Generation, renewables, distribution, storage and embedded generation.',3),
  ('infrastructure-logistics','Infrastructure and logistics','Transport, roads, warehousing, ports, corridors and supply chain systems.',4),
  ('technology','Technology','ICT, software, fintech, data and digital transformation of services.',5),
  ('financial-services','Financial services','Banking, capital access, insurance and remittance-linked products.',6),
  ('health','Health','Healthcare delivery, facilities, medical equipment, allied health and public health.',7),
  ('education-skills','Education and skills','Schools, technical and vocational training, curriculum, mentorship and teaching.',8),
  ('tourism-hospitality','Tourism and hospitality','Destinations, accommodation, roots and heritage travel, and visitor services.',9),
  ('creative-industries','Creative industries','Music, film, animation, fashion, publishing and digital content as commercial sectors.',10),
  ('culture-heritage','Culture and heritage','Preservation, festivals, language, oral history and traditional authority partnerships.',11),
  ('real-estate-housing','Real estate and housing','Housing development, property, land servicing and community facilities.',12);

insert into public.pathways (slug, name, description, offer_label, seek_label, sort_order) values
  ('capital','Capital','Money moving into or within a region, including co-investment and guarantees.','Offering capital','Seeking capital',1),
  ('build','Build','Starting, operating or partnering on a venture or project on the ground.','Offering to build','Seeking a partner',2),
  ('serve','Serve','Skills, expertise, mentorship and professional time given to a need.','Offering expertise','Seeking expertise',3),
  ('connect','Connect','Introductions, market access and institutional doors opened for someone else.','Offering access','Seeking access',4),
  ('return','Return','Relocation, land, hosting, heritage and the practical path back.','Offering support to return','Seeking support to return',5),
  ('amplify','Amplify','Audience, media, convening and advocacy that raises visibility.','Offering reach','Seeking visibility',6);

insert into public.opportunity_tags (slug, name, description, sort_order) values
  ('grow24','Grow24','24H+ sub-programme: strategic agricultural value chains, including the Eden Volta flagship.',1),
  ('make24','Make24','24H+ sub-programme: strategic manufacturing value chains.',2),
  ('build24','Build24','24H+ sub-programme: hard infrastructure for agroecological parks, industrial zones and logistics.',3),
  ('show24','Show24','24H+ sub-programme: arts, heritage and tourism as economic drivers.',4),
  ('connect24','Connect24','24H+ sub-programme: multimodal logistics, cold chain and digital trade.',5),
  ('fund24','Fund24','24H+ sub-programme: financial architecture and special purpose vehicles.',6),
  ('aspire24','Aspire24','24H+ sub-programme: skills and education aligned to the employment ecosystem.',7),
  ('go24','Go24','24H+ sub-programme: embedding 24H+ into MDA and MMDA operations.',8),
  ('big-push','Big Push','National Infrastructure Development Programme.',9),
  ('export-oriented','Export oriented','Produces for regional or international markets.',10),
  ('green','Green','Renewable, climate-smart, or part of green industrialisation.',11),
  ('youth-employment','Youth employment','Creates significant employment for young people.',12),
  ('women-led','Women led','Led by or primarily benefiting women.',13);

create table public.place_types (
  slug        text primary key,
  name        text not null,
  description text not null,
  sort_order  smallint not null unique
);

insert into public.place_types (slug, name, description, sort_order) values
  ('country','Country','National level. Holds needs that are not regionally scoped.',1),
  ('region','Region','First-level subnational administration. Detail lives in ghana_regions.',2),
  ('district','District','Metropolitan, municipal or district assembly. The counterparty that owns land, issues permits and holds sites.',3),
  ('traditional-area','Traditional area','Paramountcy or traditional authority. Crosses district boundaries and does not nest inside them.',4),
  ('community','Community','A named settlement a need or heritage record actually references. Created on demand.',5);

create table public.place_link_types (
  slug          text primary key,
  name          text not null,
  description   text not null,
  single_parent boolean not null
);

insert into public.place_link_types (slug, name, description, single_parent) values
  ('administrative','Administrative','Country contains region contains district contains community.',true),
  ('traditional','Traditional','Traditional area contains community. Cuts across administrative boundaries.',false);

create table public.publication_depths (
  slug        text primary key,
  name        text not null,
  description text not null,
  sort_order  smallint not null unique
);

insert into public.publication_depths (slug, name, description, sort_order) values
  ('listed','Listed','Name, parents, and everything derived from member and need activity.',1),
  ('profiled','Profiled','Adds sourced economic character, priority sectors and key institutions.',2),
  ('partnered','Partnered','Adds a verified assembly or authority relationship and a representative who can submit needs.',3);

create table public.places (
  slug                 text primary key,
  type_slug            text not null references public.place_types (slug) on update cascade on delete restrict,
  url_path             text not null,
  name                 text not null,
  capital              text,
  zone                 text,
  summary              text,
  depth_slug           text not null default 'listed'
                            references public.publication_depths (slug) on update cascade on delete restrict,
  is_published         boolean not null default true,
  cultural_review_at   timestamptz,
  cultural_review_note text,
  data_confidence      text not null default 'Estimate'
                            references public.data_confidence_levels (label) on update cascade on delete restrict,
  reference_source     text,
  reference_verified   date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint places_slug_format check (slug ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  constraint places_url_path_format check (url_path ~ '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$'),
  constraint places_name_not_blank check (length(btrim(name)) > 0),
  constraint places_traditional_review_required
    check (type_slug <> 'traditional-area' or is_published = false or cultural_review_at is not null),
  constraint places_conflicted_not_published
    check (data_confidence <> 'Conflicted' or is_published = false)
);

comment on table public.places is
  'Every addressable place. Slug is the key; url_path is the route and is globally unique, because district names collide across regions. Region detail, design tokens and provenance stay in ghana_regions.';

create unique index places_url_path_key on public.places (url_path);
create index places_type_idx on public.places (type_slug) where is_published;
create index places_depth_idx on public.places (depth_slug);

create trigger places_touch before update on public.places for each row execute function public.touch_updated_at();

create table public.place_links (
  parent_slug    text not null references public.places (slug) on update cascade on delete cascade,
  child_slug     text not null references public.places (slug) on update cascade on delete cascade,
  link_type_slug text not null references public.place_link_types (slug) on update cascade on delete restrict,
  created_at     timestamptz not null default now(),
  primary key (parent_slug, child_slug, link_type_slug),
  constraint place_links_no_self check (parent_slug <> child_slug)
);

comment on table public.place_links is
  'Containment edges. Two hierarchies over one place table, because traditional areas cross district boundaries. A community sits under both.';

create unique index place_links_single_admin_parent
  on public.place_links (child_slug) where link_type_slug = 'administrative';

create index place_links_parent_idx on public.place_links (parent_slug, link_type_slug);

insert into public.places (slug, type_slug, url_path, name, data_confidence, reference_source, reference_verified)
values ('ghana','country','ghana','Ghana','Sourced','Constitution of Ghana, 1992','2026-08-27');

insert into public.places (slug, type_slug, url_path, name, capital, zone, data_confidence, reference_source, reference_verified)
select r.slug, 'region', r.slug, r.name, r.capital, r.band, r.data_confidence, r.reference_source, r.reference_verified
from public.ghana_regions r;

insert into public.place_links (parent_slug, child_slug, link_type_slug)
select 'ghana', p.slug, 'administrative' from public.places p where p.type_slug = 'region';

alter table public.ghana_regions
  add constraint ghana_regions_place_fkey
  foreign key (slug) references public.places (slug) on update cascade on delete restrict;

comment on table public.ghana_regions is
  'Region extension table. places holds the addressable place; this holds region-specific detail: sort order, former name, 2018 derivation, ecological band, and the design tokens (pattern, ink_token, fill_token) used by the sixteen-region colour system.';

create table public.region_priority_sectors (
  place_slug  text not null references public.places (slug) on update cascade on delete cascade,
  sector_slug text not null references public.sectors (slug) on update cascade on delete restrict,
  rank        smallint not null,
  note        text,
  declared_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (place_slug, sector_slug),
  constraint rps_rank_range check (rank between 1 and 12),
  constraint rps_note_length check (note is null or length(btrim(note)) between 1 and 500)
);

comment on table public.region_priority_sectors is
  'Which sectors a place has declared as priority, and in what order. The only source of difference between region pages.';

create unique index rps_place_rank_key on public.region_priority_sectors (place_slug, rank);
create index rps_sector_idx on public.region_priority_sectors (sector_slug);
create trigger rps_touch before update on public.region_priority_sectors for each row execute function public.touch_updated_at();

do $mig$
declare d record;
begin
  for d in select * from (values
    ('keta-municipal','Keta Municipal','Keta','southern-coastal','Fishing, salt production, heritage tourism at Fort Prinzenstein, active coastal erosion risk'),
    ('anloga','Anloga District','Anloga','southern-coastal','Irrigated shallot farming, salt production, artisanal fishing'),
    ('ketu-south-municipal','Ketu South Municipal','Denu','southern-coastal','Cross-border trade at the Aflao crossing, fishing, market services'),
    ('ketu-north-municipal','Ketu North Municipal','Afife','southern-coastal','Rice under the Afife irrigation scheme, oil palm'),
    ('akatsi-south-municipal','Akatsi South Municipal','Akatsi','southern-coastal','Cassava and maize production, market trade'),
    ('akatsi-north','Akatsi North District',null,'southern-coastal','Food crop farming, market trade'),
    ('ho-municipal','Ho Municipal','Ho','capital-central','Regional administration, University of Health and Allied Sciences, Node 8 technology hub, hospitality'),
    ('ho-west','Ho West District',null,'capital-central','Food crops and peri-urban services for Ho'),
    ('adaklu','Adaklu District',null,'capital-central','Agriculture; 1,500-acre industrial park site under development'),
    ('south-dayi','South Dayi District','Kpeve','capital-central','Cocoa, coffee, cassava, food crops'),
    ('agotime-ziope','Agotime-Ziope District','Kpetoe','capital-central','Ewe kente weaving; Kpetoe and Agbozume are GI-registered weaving centres'),
    ('central-tongu','Central Tongu District','Adidome','capital-central','Agriculture, Lake Volta fishing, Volta River corridor'),
    ('north-tongu','North Tongu District',null,'capital-central','Agriculture, fishing, river transport, light trade'),
    ('hohoe-municipal','Hohoe Municipal','Hohoe','highland-border','Cocoa, coffee and ginger, tourism at Wli Falls, timber'),
    ('kpando-municipal','Kpando Municipal','Kpando','highland-border','Lake Volta fishing, agriculture, Kpando Torkor port'),
    ('afadjato-south','Afadjato South District',null,'highland-border','Nature tourism at Mount Afadjato and Tafi Atome, agriculture, eco-lodges')
  ) as t(slug,name,capital,zone,summary)
  loop
    insert into public.places (slug, type_slug, url_path, name, capital, zone, summary, data_confidence, reference_source, reference_verified)
    values (d.slug,'district','volta/'||d.slug,d.name,d.capital,d.zone,d.summary,
            'Estimate','ADVCF Volta Regional Intelligence File v1.0','2026-04-01');

    insert into public.place_links (parent_slug, child_slug, link_type_slug)
    values ('volta', d.slug, 'administrative');
  end loop;
end;
$mig$;

insert into public.places
  (slug, type_slug, url_path, name, summary, is_published, data_confidence, reference_source)
values
  ('agotime','traditional-area','traditional/agotime','Agotime Traditional Area',
   'Kente weaving authority. Boundaries do not coincide with the Agotime-Ziope district.',
   false,'Estimate','Pending confirmation with the traditional authority');

insert into public.places
  (slug, type_slug, url_path, name, summary, data_confidence, reference_source, reference_verified)
values
  ('kpetoe','community','volta/agotime-ziope/kpetoe','Kpetoe',
   'GI-registered kente weaving centre. Protection is registered to the community, not to the district.',
   'Sourced','WIPO Geographical Indication registration','2025-09-01');

insert into public.place_links (parent_slug, child_slug, link_type_slug) values
  ('agotime-ziope','kpetoe','administrative'),
  ('agotime','kpetoe','traditional');

do $rls$
declare t text;
begin
  foreach t in array array[
    'data_confidence_levels','sectors','pathways','opportunity_tags',
    'place_types','place_link_types','publication_depths',
    'places','place_links','region_priority_sectors'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end;
$rls$;

create policy dcl_select      on public.data_confidence_levels for select to anon, authenticated using (true);
create policy ptypes_select   on public.place_types            for select to anon, authenticated using (true);
create policy pltypes_select  on public.place_link_types       for select to anon, authenticated using (true);
create policy depths_select   on public.publication_depths     for select to anon, authenticated using (true);
create policy sectors_select  on public.sectors                for select to anon, authenticated using (is_active);
create policy pathways_select on public.pathways               for select to anon, authenticated using (is_active);
create policy tags_select     on public.opportunity_tags       for select to anon, authenticated using (is_active);

create policy places_select_published
  on public.places for select to anon, authenticated
  using (is_published);

create policy place_links_select_published
  on public.place_links for select to anon, authenticated
  using (
    exists (select 1 from public.places p where p.slug = place_links.parent_slug and p.is_published)
    and exists (select 1 from public.places c where c.slug = place_links.child_slug and c.is_published)
  );

create policy rps_select
  on public.region_priority_sectors for select to anon, authenticated
  using (
    exists (select 1 from public.places p where p.slug = region_priority_sectors.place_slug and p.is_published)
    and exists (select 1 from public.sectors s where s.slug = region_priority_sectors.sector_slug and s.is_active)
  );
