-- Universal composer. Shared fields stay columns because they drive matching,
-- region pages and reporting. Type-specific fields live in a validated JSONB
-- card, and the form is generated from a registry, so a new field is a row
-- rather than a migration.

delete from public.offering_types where slug = 'knowledge';

-- ---------------------------------------------------------------------------
-- shared fields the four specs each repeated
-- ---------------------------------------------------------------------------

alter table public.offerings
  add column provider_name text,
  add column provider_logo_media_id uuid references public.media_assets (id) on delete set null,
  add column badge_text text,
  add column price_note text,
  add column cta_mode text not null default 'internal',
  add column cta_url text,
  add column cta_label text,
  add column card jsonb not null default '{}'::jsonb,
  add constraint offerings_cta_mode check (cta_mode in ('internal','external')),
  add constraint offerings_cta_external_needs_url check (cta_mode <> 'external' or cta_url is not null),
  add constraint offerings_badge_length check (badge_text is null or length(btrim(badge_text)) between 2 and 28),
  add constraint offerings_price_note_length check (price_note is null or length(btrim(price_note)) between 2 and 60);

comment on column public.offerings.provider_name is
  'Who is behind it. One field across all types: the four specs called this org_name, host_name, author_name and provider_name.';
comment on column public.offerings.price_note is
  'Early Bird, Cancel anytime, Scholarships open. Sits beside the structured price rather than replacing it, so the member discount stays computable.';
comment on column public.offerings.cta_mode is
  'internal means the platform handles it: register here, download here. external means cta_url leaves the platform.';
comment on column public.offerings.card is
  'Type-specific presentation fields, validated against offering_type_fields. Never used for matching or reporting; those live in columns.';

-- ---------------------------------------------------------------------------
-- derived social proof. Only triggers write these.
-- ---------------------------------------------------------------------------

alter table public.offerings
  add column attendee_count integer not null default 0,
  add column download_count integer not null default 0,
  add column rating_sum integer not null default 0,
  add column rating_count integer not null default 0;

comment on column public.offerings.rating_count is
  'Derived from real feedback. A typed review count on a platform that cites its sources is an invitation to invent numbers, so these four columns are written by triggers only.';

create table public.offering_feedback (
  offering_id uuid not null references public.offerings (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete restrict,
  rating      smallint not null,
  comment     text,
  created_at  timestamptz not null default now(),
  primary key (offering_id, member_id),
  constraint feedback_rating_range check (rating between 1 and 5),
  constraint feedback_comment_length check (comment is null or length(btrim(comment)) <= 1200)
);

comment on table public.offering_feedback is
  'One rating per member per offering, and only from someone who actually attended or downloaded it.';

create table public.offering_downloads (
  id          bigint generated always as identity primary key,
  offering_id uuid not null references public.offerings (id) on delete cascade,
  member_id   uuid references public.members (id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index downloads_offering_idx on public.offering_downloads (offering_id, occurred_at desc);

create or replace function public.offerings_recount()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare v_offering uuid;
begin
  v_offering := coalesce(new.offering_id, old.offering_id);

  update public.offerings o set
    attendee_count = (select count(*) from public.offering_registrations r
                       where r.offering_id = v_offering and r.state = 'attended'),
    download_count = (select count(*) from public.offering_downloads d where d.offering_id = v_offering),
    rating_sum     = (select coalesce(sum(f.rating),0) from public.offering_feedback f where f.offering_id = v_offering),
    rating_count   = (select count(*) from public.offering_feedback f where f.offering_id = v_offering)
  where o.id = v_offering;

  return null;
end;
$fn$;

create trigger recount_registrations after insert or update or delete on public.offering_registrations
  for each row execute function public.offerings_recount();
create trigger recount_downloads after insert or delete on public.offering_downloads
  for each row execute function public.offerings_recount();
create trigger recount_feedback after insert or update or delete on public.offering_feedback
  for each row execute function public.offerings_recount();

-- Feedback only from someone who was actually there.
create or replace function public.feedback_requires_participation()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if not exists (
    select 1 from public.offering_registrations r
    where r.offering_id = new.offering_id and r.member_id = new.member_id and r.state = 'attended'
  ) and not exists (
    select 1 from public.offering_downloads d
    where d.offering_id = new.offering_id and d.member_id = new.member_id
  ) then
    raise exception 'feedback requires attendance or a download' using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger feedback_participation before insert on public.offering_feedback
  for each row execute function public.feedback_requires_participation();

-- ---------------------------------------------------------------------------
-- the field registry: the composer form is generated from these rows
-- ---------------------------------------------------------------------------

create table public.offering_type_fields (
  type_slug   text not null references public.offering_types (slug) on update cascade on delete cascade,
  field_key   text not null,
  label       text not null,
  input       text not null,
  options     jsonb,
  is_required boolean not null default false,
  help        text,
  sort_order  smallint not null,
  primary key (type_slug, field_key),
  constraint otf_key_format check (field_key ~ '^[a-z][a-z0-9_]*$'),
  constraint otf_input_value check (input in ('text','textarea','select','multiselect','number','date','datetime','url','tags')),
  constraint otf_select_needs_options check (input not in ('select','multiselect') or options is not null)
);

comment on table public.offering_type_fields is
  'What the composer renders when a type is chosen, and what the database validates the card against. Adding a field is a row; adding a type is a handful of rows. No migration, no front-end change.';

create unique index otf_order_key on public.offering_type_fields (type_slug, sort_order);

insert into public.offering_type_fields (type_slug, field_key, label, input, options, is_required, help, sort_order) values
  -- Program
  ('program','program_format','Format','select','["Course","Certificate","Bootcamp","Workshop","Fellowship"]',true,null,1),
  ('program','skill_level','Skill level','select','["Beginner","Intermediate","Advanced","Mixed"]',true,null,2),
  ('program','duration_text','Duration','text',null,true,'Eight weeks. Four sessions. One term.',3),
  ('program','commitment_text','Time commitment','text',null,false,'Roughly four hours a week.',4),
  ('program','cohort_size','Cohort size','number',null,false,null,5),
  ('program','outcomes','What participants leave with','textarea',null,false,'Three or four concrete outcomes.',6),

  -- Event
  ('event','event_category','Category','select','["Town hall","Summit","Conference","Webinar","Meetup","Networking","Panel","Spotlight"]',true,null,1),
  ('event','location_details','Location details','textarea',null,false,'Venue and address, or how the join link is issued.',2),
  ('event','registration_deadline','Registration closes','datetime',null,false,'Drives urgency and stops late sign-ups.',3),
  ('event','amenities','What is included','tags',null,false,'Q&A session. Certificate of attendance. Refreshments.',4),
  ('event','ticket_tier','Ticket tier','select','["Free","Paid","Donation-based"]',true,null,5),

  -- Resource
  ('resource','resource_format','Resource type','select','["Brief","Report","Toolkit","Template","Case study","Dataset","Guide"]',true,null,1),
  ('resource','file_format','File format','select','["PDF","XLSX","DOCX","CSV","ZIP","PPTX"]',true,null,2),
  ('resource','file_size_text','Size or extent','text',null,true,'4.2 MB. Twelve pages. Three-part collection.',3),
  ('resource','access_type','Access','select','["Direct download","Members only","Email required"]',true,null,4),
  ('resource','download_url','File location','url',null,true,'Storage path or signed URL.',5),

  -- Service
  ('service','service_category','Category','select','["Advisory","Facilitation","Research","Delivery","Legal and compliance","Technical"]',true,null,1),
  ('service','pricing_model','Pricing model','select','["Hourly","Fixed fee","Retainer","Custom quote"]',true,null,2),
  ('service','turnaround_text','Turnaround','text',null,true,'Three to five working days. Two-week sprint. Ongoing.',3),
  ('service','engagement_mode','Engagement','select','["Fully managed","Collaborative","Retainer support"]',true,null,4),
  ('service','availability','Availability','select','["Available now","Booking next month","At capacity"]',true,null,5),
  ('service','deliverables','Deliverables','textarea',null,false,'What is guaranteed in the standard scope.',6);

-- ---------------------------------------------------------------------------
-- validation: a card may only carry declared fields, and must carry required ones
-- ---------------------------------------------------------------------------

create or replace function public.offerings_validate_card()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare k text; v_missing text[];
begin
  if jsonb_typeof(new.card) <> 'object' then
    raise exception 'card must be a JSON object' using errcode = 'check_violation';
  end if;

  for k in select jsonb_object_keys(new.card) loop
    if not exists (
      select 1 from public.offering_type_fields f
      where f.type_slug = new.type_slug and f.field_key = k
    ) then
      raise exception 'card field % is not declared for type %', k, new.type_slug
        using errcode = 'check_violation';
    end if;
  end loop;

  if new.state = 'published' then
    select array_agg(f.field_key order by f.sort_order) into v_missing
    from public.offering_type_fields f
    where f.type_slug = new.type_slug and f.is_required
      and (new.card ->> f.field_key) is null;

    if v_missing is not null then
      raise exception 'cannot publish: % is missing required field(s) %', new.type_slug, array_to_string(v_missing, ', ')
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$fn$;

create trigger offerings_card_validation
  before insert or update of card, type_slug, state on public.offerings
  for each row execute function public.offerings_validate_card();

-- ---------------------------------------------------------------------------
-- what the composer asks for, and what a card renders with
-- ---------------------------------------------------------------------------

create or replace function public.composer_schema(p_type text)
returns jsonb language sql stable security invoker set search_path = '' as $fn$
  select jsonb_build_object(
    'type', t.slug,
    'name', t.name,
    'description', t.description,
    'fields', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', f.field_key, 'label', f.label, 'input', f.input,
        'options', f.options, 'required', f.is_required, 'help', f.help
      ) order by f.sort_order)
      from public.offering_type_fields f where f.type_slug = t.slug
    ), '[]'::jsonb)
  )
  from public.offering_types t where t.slug = p_type;
$fn$;

comment on function public.composer_schema(text) is
  'The composer renders its type-specific section from this. One form, five shapes, no hardcoding.';

create or replace function public.offering_card(p_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $fn$
  select jsonb_build_object(
    'id', o.id, 'slug', o.slug, 'type', o.type_slug, 'title', o.title, 'summary', o.summary,
    'provider', o.provider_name, 'badge', o.badge_text,
    'place', o.place_slug, 'place_name', p.name, 'chapter', o.chapter_slug,
    'audience', o.audience, 'delivery', o.delivery, 'starts_at', o.starts_at, 'timezone', o.timezone,
    'list_price', o.list_price_amount, 'currency', o.list_price_currency, 'price_note', o.price_note,
    'perk', jsonb_build_object('kind', k.perk_kind, 'discount_percent', k.discount_percent,
                               'member_price', k.member_price_amount),
    'cta', jsonb_build_object('mode', o.cta_mode, 'url', o.cta_url, 'label', o.cta_label),
    'hero', jsonb_build_object('path', m.storage_path, 'alt', m.alt_text, 'credit', m.credit),
    'proof', jsonb_build_object(
      'attendees', nullif(o.attendee_count, 0),
      'downloads', nullif(o.download_count, 0),
      'rating', case when o.rating_count > 0 then round(o.rating_sum::numeric / o.rating_count, 1) end,
      'rating_count', nullif(o.rating_count, 0)),
    'card', o.card
  )
  from public.offerings o
  left join public.places p on p.slug = o.place_slug
  left join public.offering_perks k on k.offering_id = o.id
  left join public.offering_media om on om.offering_id = o.id and om.role = 'hero'
  left join public.media_assets m on m.id = om.media_id
  where o.id = p_id and o.state in ('published','closed');
$fn$;

comment on function public.offering_card(uuid) is
  'Everything a card needs, whatever its type. proof values are null rather than zero, so a card with no attendees renders nothing rather than a hollow boast.';

alter table public.offering_type_fields enable row level security;
alter table public.offering_feedback enable row level security;
alter table public.offering_downloads enable row level security;
alter table public.offering_type_fields force row level security;
alter table public.offering_feedback force row level security;
alter table public.offering_downloads force row level security;

revoke all on public.offering_type_fields from anon, authenticated;
revoke all on public.offering_feedback from anon, authenticated;
revoke all on public.offering_downloads from anon, authenticated;
grant select on public.offering_type_fields to anon, authenticated;
grant select, insert on public.offering_feedback to authenticated;
grant insert on public.offering_downloads to authenticated;

create policy otf_select on public.offering_type_fields for select to anon, authenticated using (true);
create policy fb_select on public.offering_feedback for select to authenticated
  using (member_id = public.current_member_id());
create policy fb_insert on public.offering_feedback for insert to authenticated
  with check (member_id = public.current_member_id());
create policy dl_insert on public.offering_downloads for insert to authenticated
  with check (member_id = public.current_member_id());

grant execute on function public.composer_schema(text) to anon, authenticated, service_role;
grant execute on function public.offering_card(uuid) to anon, authenticated, service_role;
revoke all on function public.offerings_recount() from public, anon, authenticated;
revoke all on function public.feedback_requires_participation() from public, anon, authenticated;
revoke all on function public.offerings_validate_card() from public, anon, authenticated;
