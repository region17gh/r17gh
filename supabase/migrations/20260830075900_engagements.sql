create table public.engagement_states (
  slug text primary key,
  name text not null,
  description text not null,
  is_terminal boolean not null default false,
  sort_order smallint not null unique
);

insert into public.engagement_states (slug, name, description, is_terminal, sort_order) values
  ('expressed','Expressed','A member has said what they can bring to this. Nothing has been assessed yet.',false,1),
  ('in-review','In review','Region 17 is triaging against the need and the stakeholder requirements. A response is owed by review_due_at.',false,2),
  ('matched','Matched','Both sides accepted. Identities are revealed from this point.',false,3),
  ('active','Active','Work is underway. Milestones are reported by the owner.',false,4),
  ('delivered','Delivered','The outcome has been recorded against the place and the participants.',false,5),
  ('closed','Closed','Concluded, story captured, recognition applied.',true,6),
  ('redirected','Redirected','Pointed at a different need or place that fits better. An exit from review that is never a bare no.',true,7),
  ('held','Held','Parked for a future cycle with a date to revisit. An exit from review that is never a bare no.',false,8),
  ('withdrawn','Withdrawn','The member stepped back. Only a participant can reach this state.',true,9);

comment on table public.engagement_states is
  'There is deliberately no declined state. The three exits from review are matched, redirected and held. A diaspora member offering their skills to their ancestral homeland does not receive a bare no.';

create table public.engagement_transitions (
  from_state text not null references public.engagement_states (slug) on update cascade on delete restrict,
  to_state   text not null references public.engagement_states (slug) on update cascade on delete restrict,
  actor      text not null,
  note       text,
  primary key (from_state, to_state),
  constraint et_actor_value check (actor in ('member','region17','either'))
);

insert into public.engagement_transitions (from_state, to_state, actor, note) values
  ('expressed','in-review','region17','Triage begins. The review clock starts here.'),
  ('expressed','withdrawn','member',null),
  ('in-review','matched','region17','Both sides accepted.'),
  ('in-review','redirected','region17','Routed to a better-fitting need or place.'),
  ('in-review','held','region17','Parked with a revisit date.'),
  ('in-review','withdrawn','member',null),
  ('held','in-review','region17','Revisited in a later cycle.'),
  ('held','closed','region17','Concluded without proceeding, with the reason recorded.'),
  ('matched','active','either','Work begins.'),
  ('matched','held','region17',null),
  ('matched','withdrawn','member',null),
  ('active','delivered','region17','Outcome recorded.'),
  ('active','held','region17',null),
  ('delivered','closed','region17','Story captured, recognition applied.');

create table public.engagements (
  id                 uuid primary key default gen_random_uuid(),
  place_slug         text not null references public.places (slug) on update cascade on delete restrict,
  need_id            uuid references public.needs (id) on delete restrict,
  declaration_id     uuid references public.declarations (id) on delete set null,
  direction          text not null,
  title              text not null,
  summary            text,
  state              text not null default 'expressed'
                       references public.engagement_states (slug) on update cascade on delete restrict,

  opened_by          uuid not null references public.members (id) on delete restrict,
  opened_at          timestamptz not null default now(),
  review_due_at      timestamptz not null default (now() + interval '14 days'),
  reviewed_at        timestamptz,
  reviewed_by        uuid references public.members (id) on delete restrict,

  identity_revealed_at timestamptz,
  redirected_to_id   uuid references public.engagements (id) on delete set null,
  redirect_note      text,
  held_until         date,
  delivered_at       timestamptz,
  closed_at          timestamptz,
  outcome_note       text,

  entity             text,
  r17_role           text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint engagements_direction_value check (direction in ('seek','offer')),
  constraint engagements_title_length check (length(btrim(title)) between 3 and 160),
  constraint engagements_entity_value check (entity is null or entity in ('nonprofit','for-profit')),
  constraint engagements_r17_role_value check (r17_role is null or r17_role in ('convening','organizing')),
  constraint engagements_matched_reveals check (state not in ('matched','active','delivered','closed') or identity_revealed_at is not null),
  constraint engagements_redirect_has_reason check (state <> 'redirected' or (redirected_to_id is not null or redirect_note is not null)),
  constraint engagements_held_has_date check (state <> 'held' or held_until is not null),
  constraint engagements_no_self_redirect check (redirected_to_id is null or redirected_to_id <> id)
);

comment on column public.engagements.need_id is
  'Nullable on purpose. An unsolicited proposal enters the same review state as a response to a posted need, because a lot of real diaspora value arrives as something nobody thought to ask for.';
comment on column public.engagements.review_due_at is
  'The response deadline. Fourteen days by default; change the default once the number is decided. An engagement sitting past this date with no response is the failure mode most likely to cost trust.';
comment on column public.engagements.r17_role is
  'convening means Region 17 introduced the parties. organizing means Region 17 structured the vehicle. Different legal postures, recorded from the first row.';

create index engagements_place_idx on public.engagements (place_slug, state);
create index engagements_need_idx on public.engagements (need_id);
create index engagements_overdue_idx on public.engagements (review_due_at) where state in ('expressed','in-review');

create trigger engagements_touch before update on public.engagements
  for each row execute function public.touch_updated_at();

create table public.engagement_participants (
  engagement_id   uuid not null references public.engagements (id) on delete cascade,
  member_id       uuid not null references public.members (id) on delete restrict,
  participant_role text not null default 'participant',
  contribution_note text,
  joined_at       timestamptz not null default now(),
  left_at         timestamptz,
  primary key (engagement_id, member_id),
  constraint ep_role_value check (participant_role in ('lead','participant'))
);

comment on table public.engagement_participants is
  'Many members, one engagement. Diaspora capital moves in groups: susu, investment clubs, hometown associations. An engagement that could only ever hold one person would make the Capital pathway decorative for most of the register.';

create unique index engagement_one_lead
  on public.engagement_participants (engagement_id)
  where participant_role = 'lead' and left_at is null;

create index ep_member_idx on public.engagement_participants (member_id) where left_at is null;

create table public.milestones (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  sequence      smallint not null,
  title         text not null,
  detail        text,
  due_on        date,
  completed_on  date,
  reported_by   uuid references public.members (id) on delete restrict,
  reported_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint milestones_title_length check (length(btrim(title)) between 3 and 160),
  constraint milestones_sequence_positive check (sequence > 0),
  constraint milestones_completion_reported check (completed_on is null or reported_by is not null)
);

comment on table public.milestones is
  'Region 17 records milestones; the engagement owner reports them. Region 17 is the ledger of record, not the project manager, and the UI language must say so on every milestone.';

create unique index milestones_sequence_key on public.milestones (engagement_id, sequence);
create trigger milestones_touch before update on public.milestones
  for each row execute function public.touch_updated_at();

-- Only declared transitions are permitted. This is what makes "no bare no" structural.
create or replace function public.engagements_validate_transition()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if new.state = old.state then
    return new;
  end if;
  if not exists (
    select 1 from public.engagement_transitions t
    where t.from_state = old.state and t.to_state = new.state
  ) then
    raise exception 'engagement cannot move from % to %', old.state, new.state
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger engagements_validate_transition_trg
  before update of state on public.engagements
  for each row execute function public.engagements_validate_transition();

-- Place must be published, and a need-linked engagement must sit at the need's place.
create or replace function public.engagements_validate_scope()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if not exists (select 1 from public.places p where p.slug = new.place_slug and p.is_published) then
    raise exception 'engagements attach to a published place; % is not published', new.place_slug
      using errcode = 'foreign_key_violation';
  end if;
  if new.need_id is not null and not exists (
    select 1 from public.needs n where n.id = new.need_id and n.place_slug = new.place_slug
  ) then
    raise exception 'engagement place must match the place of the need it responds to'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger engagements_validate_scope_trg
  before insert or update of place_slug, need_id on public.engagements
  for each row execute function public.engagements_validate_scope();

alter table public.engagement_states enable row level security;
alter table public.engagement_transitions enable row level security;
alter table public.engagements enable row level security;
alter table public.engagement_participants enable row level security;
alter table public.milestones enable row level security;
alter table public.engagement_states force row level security;
alter table public.engagement_transitions force row level security;
alter table public.engagements force row level security;
alter table public.engagement_participants force row level security;
alter table public.milestones force row level security;

revoke all on public.engagement_states from anon, authenticated;
revoke all on public.engagement_transitions from anon, authenticated;
revoke all on public.engagements from anon, authenticated;
revoke all on public.engagement_participants from anon, authenticated;
revoke all on public.milestones from anon, authenticated;

grant select on public.engagement_states to anon, authenticated;
grant select on public.engagement_transitions to anon, authenticated;
grant select, insert on public.engagements to authenticated;
grant select on public.engagement_participants to authenticated;
grant select on public.milestones to authenticated;

create policy es_select on public.engagement_states for select to anon, authenticated using (true);
create policy etr_select on public.engagement_transitions for select to anon, authenticated using (true);

create policy engagements_select_participant
  on public.engagements for select to authenticated
  using (
    opened_by = public.current_member_id()
    or exists (
      select 1 from public.engagement_participants p
      where p.engagement_id = engagements.id
        and p.member_id = public.current_member_id()
    )
    or public.can_submit_need(place_slug)
  );

create policy engagements_insert_own
  on public.engagements for insert to authenticated
  with check (
    opened_by = public.current_member_id()
    and state = 'expressed'
    and identity_revealed_at is null
  );

create policy ep_select_participant
  on public.engagement_participants for select to authenticated
  using (
    member_id = public.current_member_id()
    or exists (
      select 1 from public.engagements e
      where e.id = engagement_participants.engagement_id
        and (e.opened_by = public.current_member_id() or public.can_submit_need(e.place_slug))
    )
  );

create policy milestones_select_participant
  on public.milestones for select to authenticated
  using (
    exists (
      select 1 from public.engagements e
      where e.id = milestones.engagement_id
        and (
          e.opened_by = public.current_member_id()
          or public.can_submit_need(e.place_slug)
          or exists (select 1 from public.engagement_participants p
                     where p.engagement_id = e.id and p.member_id = public.current_member_id())
        )
    )
  );
