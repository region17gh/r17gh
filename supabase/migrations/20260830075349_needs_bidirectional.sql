create table public.opportunity_types (
  slug text primary key,
  name text not null,
  description text not null,
  applies_to text not null,
  sort_order smallint not null unique,
  constraint opportunity_types_applies check (applies_to in ('seek','offer','both'))
);

insert into public.opportunity_types (slug, name, description, applies_to, sort_order) values
  ('joint-venture','Joint venture','A partnership vehicle with local and diaspora participation.','seek',1),
  ('equity','Equity','Direct equity participation.','seek',2),
  ('debt','Debt','Loan or credit facility sought.','seek',3),
  ('offtake','Offtake','A guaranteed purchase commitment.','both',4),
  ('technical-partnership','Technical partnership','Expertise, systems or training rather than capital.','both',5),
  ('greenfield','Greenfield','A new build from nothing.','seek',6),
  ('expansion','Expansion','Scaling something already operating.','seek',7),
  ('land','Land','Land made available for development, farming or housing.','offer',8),
  ('placement','Placement','A volunteer, apprenticeship, internship or residency position.','offer',9),
  ('exchange','Exchange','A cultural, academic or professional exchange.','offer',10),
  ('hosting','Hosting','Homestay, hosting or reception for a visiting member.','offer',11),
  ('programme','Programme','A festival, course, heritage programme or organised visit.','offer',12),
  ('market-access','Market access','Introductions, distribution or route to a local market.','offer',13);

create table public.need_statuses (
  slug text primary key,
  name text not null,
  description text not null,
  sort_order smallint not null unique
);

insert into public.need_statuses (slug, name, description, sort_order) values
  ('identified','Identified','Named in a plan or by a stakeholder. Not yet packaged.',1),
  ('in-preparation','In preparation','Feasibility, siting or packaging underway.',2),
  ('ready','Ready','Site, terms or programme are ready for a partner.',3),
  ('announced','Announced','Publicly committed by an institution.',4),
  ('active','Active','Work is underway with participants.',5),
  ('closed','Closed','Concluded. Kept for the record.',6);

create table public.needs (
  id                 uuid primary key default gen_random_uuid(),
  place_slug         text not null references public.places (slug) on update cascade on delete restrict,
  direction          text not null,
  title              text not null,
  summary            text not null,
  detail             text,
  sector_slug        text references public.sectors (slug) on update cascade on delete restrict,
  opportunity_type   text references public.opportunity_types (slug) on update cascade on delete restrict,
  status_slug        text not null default 'identified'
                       references public.need_statuses (slug) on update cascade on delete restrict,

  investment_amount  numeric(14,2),
  investment_currency text,
  investment_note    text,
  projected_employment integer,
  projected_annual_sales numeric(14,2),
  projected_sales_currency text,

  state              text not null default 'submitted',
  submitted_by       uuid references public.members (id) on delete restrict,
  submitted_at       timestamptz not null default now(),
  published_at       timestamptz,
  published_by       uuid references public.members (id) on delete restrict,
  closes_at          date,

  data_confidence    text not null default 'Estimate'
                       references public.data_confidence_levels (label) on update cascade on delete restrict,
  reference_source   text,
  reference_verified date,
  review_flag        text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint needs_direction_value check (direction in ('seek','offer')),
  constraint needs_state_value check (state in ('draft','submitted','published','withdrawn')),
  constraint needs_title_length check (length(btrim(title)) between 3 and 160),
  constraint needs_summary_length check (length(btrim(summary)) between 10 and 600),
  constraint needs_detail_length check (detail is null or length(btrim(detail)) <= 6000),
  constraint needs_currency_shape check (investment_currency is null or investment_currency ~ '^[A-Z]{3}$'),
  constraint needs_sales_currency_shape check (projected_sales_currency is null or projected_sales_currency ~ '^[A-Z]{3}$'),
  constraint needs_amount_needs_currency check (investment_amount is null or investment_currency is not null),
  constraint needs_sales_needs_currency check (projected_annual_sales is null or projected_sales_currency is not null),
  constraint needs_employment_positive check (projected_employment is null or projected_employment >= 0),
  constraint needs_published_stamped check (state <> 'published' or (published_at is not null and published_by is not null)),
  constraint needs_conflicted_not_published check (data_confidence <> 'Conflicted' or state <> 'published')
);

comment on table public.needs is
  'What a place asks for and what a place offers. Bidirectional by construction: direction seek is a need, direction offer is something the region makes available to the diaspora. Without both, the platform can only extract.';
comment on column public.needs.direction is
  'seek: the place is asking. offer: the place is providing. A member offer matches a place seek; a member seek matches a place offer. Same engine, both ways.';
comment on column public.needs.state is
  'Stakeholders submit, Region 17 publishes. A role holder can create and edit while submitted; only service_role can move a row to published.';

create index needs_match_idx on public.needs (place_slug, direction, sector_slug) where state = 'published';
create index needs_place_idx on public.needs (place_slug) where state = 'published';
create index needs_submitter_idx on public.needs (submitted_by);

create trigger needs_touch before update on public.needs
  for each row execute function public.touch_updated_at();

create table public.need_pathways (
  need_id      uuid not null references public.needs (id) on delete cascade,
  pathway_slug text not null references public.pathways (slug) on update cascade on delete restrict,
  primary key (need_id, pathway_slug)
);

create table public.need_tags (
  need_id  uuid not null references public.needs (id) on delete cascade,
  tag_slug text not null references public.opportunity_tags (slug) on update cascade on delete restrict,
  primary key (need_id, tag_slug)
);

create index need_pathways_pathway_idx on public.need_pathways (pathway_slug);
create index need_tags_tag_idx on public.need_tags (tag_slug);

-- Place must be published. Traditional areas stay out until cultural review clears them.
create or replace function public.needs_validate_place()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if not exists (select 1 from public.places p where p.slug = new.place_slug and p.is_published) then
    raise exception 'needs attach to a published place; % is not published', new.place_slug
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$fn$;

create trigger needs_validate_place_trg
  before insert or update of place_slug on public.needs
  for each row execute function public.needs_validate_place();

-- Who may submit for a place: a role holder on that place or on any administrative ancestor.
create or replace function public.can_submit_need(p_place_slug text)
returns boolean language sql stable security definer set search_path = '' as $fn$
  with recursive chain as (
    select p_place_slug as slug
    union all
    select l.parent_slug
    from public.place_links l
    join chain c on c.slug = l.child_slug
    where l.link_type_slug = 'administrative'
  )
  select exists (
    select 1
    from public.roles r
    join public.role_types rt on rt.slug = r.role_slug
    where r.member_id = public.current_member_id()
      and r.state = 'active'
      and r.subject_kind = 'place'
      and rt.grants_need_submission
      and r.subject_slug in (select slug from chain)
  );
$fn$;

comment on function public.can_submit_need(text) is
  'A regional representative may submit for their region and for every district under it. A district representative may submit only for their district.';

alter table public.opportunity_types enable row level security;
alter table public.need_statuses enable row level security;
alter table public.needs enable row level security;
alter table public.need_pathways enable row level security;
alter table public.need_tags enable row level security;
alter table public.opportunity_types force row level security;
alter table public.need_statuses force row level security;
alter table public.needs force row level security;
alter table public.need_pathways force row level security;
alter table public.need_tags force row level security;

revoke all on public.opportunity_types from anon, authenticated;
revoke all on public.need_statuses from anon, authenticated;
revoke all on public.needs from anon, authenticated;
revoke all on public.need_pathways from anon, authenticated;
revoke all on public.need_tags from anon, authenticated;

grant select on public.opportunity_types to anon, authenticated;
grant select on public.need_statuses to anon, authenticated;
grant select on public.needs to anon, authenticated;
grant insert, update on public.needs to authenticated;
grant select on public.need_pathways to anon, authenticated;
grant select on public.need_tags to anon, authenticated;
grant insert, delete on public.need_pathways to authenticated;
grant insert, delete on public.need_tags to authenticated;

create policy ot_select on public.opportunity_types for select to anon, authenticated using (true);
create policy ns_select on public.need_statuses for select to anon, authenticated using (true);

create policy needs_select_published
  on public.needs for select to anon, authenticated
  using (
    state = 'published'
    and exists (select 1 from public.places p where p.slug = needs.place_slug and p.is_published)
  );

create policy needs_select_own_submission
  on public.needs for select to authenticated
  using (submitted_by = public.current_member_id());

create policy needs_insert_by_role
  on public.needs for insert to authenticated
  with check (
    submitted_by = public.current_member_id()
    and state in ('draft','submitted')
    and public.can_submit_need(place_slug)
  );

create policy needs_update_own_submission
  on public.needs for update to authenticated
  using (submitted_by = public.current_member_id() and state in ('draft','submitted'))
  with check (submitted_by = public.current_member_id() and state in ('draft','submitted','withdrawn'));

create policy need_pathways_select on public.need_pathways for select to anon, authenticated
  using (exists (select 1 from public.needs n where n.id = need_pathways.need_id and n.state = 'published'));
create policy need_tags_select on public.need_tags for select to anon, authenticated
  using (exists (select 1 from public.needs n where n.id = need_tags.need_id and n.state = 'published'));

create policy need_pathways_write on public.need_pathways for insert to authenticated
  with check (exists (select 1 from public.needs n where n.id = need_pathways.need_id and n.submitted_by = public.current_member_id()));
create policy need_tags_write on public.need_tags for insert to authenticated
  with check (exists (select 1 from public.needs n where n.id = need_tags.need_id and n.submitted_by = public.current_member_id()));
