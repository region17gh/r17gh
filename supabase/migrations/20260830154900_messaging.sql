create table public.messaging_preferences (
  member_id        uuid primary key references public.members (id) on delete restrict,
  inbound_open     boolean not null default false,
  read_receipts    boolean not null default true,
  typing_indicators boolean not null default true,
  retention_months smallint not null default 36,
  updated_at       timestamptz not null default now(),
  constraint mp_retention_range check (retention_months between 1 and 36)
);

comment on table public.messaging_preferences is
  'Inbound is closed by default. On a platform where members declare publicly that they hold capital, an open inbox is a target list, so opening it is a deliberate act.';
comment on column public.messaging_preferences.retention_months is
  'Stated retention under Act 843. Thirty-six months on an inactive thread, member-reducible, never extendable.';

create trigger mp_touch before update on public.messaging_preferences
  for each row execute function public.touch_updated_at();

create table public.member_blocks (
  blocker_id uuid not null references public.members (id) on delete restrict,
  blocked_id uuid not null references public.members (id) on delete restrict,
  created_at timestamptz not null default now(),
  reason     text,
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

create table public.connections (
  member_low  uuid not null references public.members (id) on delete restrict,
  member_high uuid not null references public.members (id) on delete restrict,
  source      text not null,
  established_at timestamptz not null default now(),
  ended_at    timestamptz,
  primary key (member_low, member_high),
  constraint connections_ordered check (member_low < member_high),
  constraint connections_source_value check (source in ('request','engagement','admin'))
);

comment on table public.connections is
  'Ordered pair so a connection exists once, not twice. Source records how trust was established, which is what the thread header shows.';

create table public.connection_requests (
  id           uuid primary key default gen_random_uuid(),
  from_member  uuid not null references public.members (id) on delete restrict,
  to_member    uuid not null references public.members (id) on delete restrict,
  context_kind text not null,
  context_id   text not null,
  note         text,
  state        text not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  expires_at   timestamptz not null default (now() + interval '30 days'),
  constraint cr_no_self check (from_member <> to_member),
  constraint cr_state_value check (state in ('pending','accepted','declined','withdrawn','expired')),
  constraint cr_context_kind check (context_kind in ('need','declaration','engagement','place')),
  constraint cr_note_length check (note is null or length(btrim(note)) between 1 and 400)
);

comment on table public.connection_requests is
  'First contact is the whole product. A request must attach to something on the platform, so the recipient sees "responding to your Adaklu posting" rather than a cold pitch. Structured first contact removes most spam by construction, and no consumer messenger can copy it because none of them hold the context.';
comment on column public.connection_requests.note is
  'Capped at 400 characters on purpose. A first contact is an introduction, not a proposal.';

create unique index cr_one_pending on public.connection_requests (from_member, to_member) where state = 'pending';
create index cr_inbox_idx on public.connection_requests (to_member, state, created_at desc);

create table public.threads (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,
  engagement_id uuid references public.engagements (id) on delete restrict,
  subject       text,
  state         text not null default 'active',
  created_at    timestamptz not null default now(),
  last_message_at timestamptz,
  archived_at   timestamptz,
  constraint threads_kind_value check (kind in ('direct','engagement')),
  constraint threads_state_value check (state in ('active','archived')),
  constraint threads_engagement_required check (kind <> 'engagement' or engagement_id is not null),
  constraint threads_direct_has_no_engagement check (kind <> 'direct' or engagement_id is null)
);

comment on table public.threads is
  'Direct threads and engagement group threads share one table. An engagement thread is created when the engagement reaches matched, which is the same moment identities are revealed. A consortium of thirty-five with no group thread would be on WhatsApp within a day.';

create unique index threads_one_per_engagement on public.threads (engagement_id) where engagement_id is not null;
create index threads_recent_idx on public.threads (last_message_at desc nulls last);

create table public.thread_participants (
  thread_id    uuid not null references public.threads (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete restrict,
  joined_at    timestamptz not null default now(),
  left_at      timestamptz,
  muted        boolean not null default false,
  last_read_at timestamptz,
  primary key (thread_id, member_id)
);

create index tp_member_idx on public.thread_participants (member_id) where left_at is null;

create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references public.threads (id) on delete cascade,
  sender_id    uuid not null references public.members (id) on delete restrict,
  body         text,
  ciphertext   bytea,
  reply_to_id  uuid references public.messages (id) on delete set null,
  state        text not null default 'sent',
  created_at   timestamptz not null default now(),
  edited_at    timestamptz,
  deleted_at   timestamptz,
  constraint messages_state_value check (state in ('sent','deleted')),
  constraint messages_one_payload check (
    (body is not null and ciphertext is null)
    or (body is null and ciphertext is not null)
    or (state = 'deleted' and body is null and ciphertext is null)
  ),
  constraint messages_body_length check (body is null or length(body) <= 8000),
  constraint messages_deleted_stamped check (state <> 'deleted' or deleted_at is not null)
);

comment on table public.messages is
  'Exactly one of body or ciphertext is populated. Launch writes plaintext with encryption at rest and a written no-read policy; end-to-end encryption later fills ciphertext instead, with no restructuring. Half-built E2EE is worse than none, because people trust it and act accordingly.';

create index messages_thread_idx on public.messages (thread_id, created_at desc);

create table public.message_attachments (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.messages (id) on delete cascade,
  kind         text not null,
  storage_path text not null,
  filename     text,
  mime_type    text,
  byte_size    bigint,
  created_at   timestamptz not null default now(),
  constraint ma_kind_value check (kind in ('image','document','voice','video')),
  constraint ma_size_positive check (byte_size is null or byte_size > 0)
);

create index ma_message_idx on public.message_attachments (message_id);

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete restrict,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, member_id, emoji),
  constraint mr_emoji_length check (length(emoji) between 1 and 8)
);

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.members (id) on delete restrict,
  subject_kind text not null,
  subject_id   text not null,
  reason       text not null,
  excerpt      text,
  state        text not null default 'open',
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolution   text,
  constraint reports_subject_kind check (subject_kind in ('message','thread','member','need','declaration')),
  constraint reports_reason_value check (reason in ('spam','fraud','harassment','impersonation','off-platform-solicitation','other')),
  constraint reports_state_value check (state in ('open','reviewing','actioned','dismissed'))
);

comment on table public.reports is
  'Ships in the same migration as messages, never as a follow-up. excerpt is captured at report time so the evidence survives the sender deleting the message, and so it still works when bodies become ciphertext Region 17 cannot read.';
comment on column public.reports.reason is
  'off-platform-solicitation exists because advance-fee fraud against diaspora investors typically opens by moving the conversation to WhatsApp.';

create index reports_open_idx on public.reports (state, created_at) where state in ('open','reviewing');

-- ---------------------------------------------------------------------------
-- the gate
-- ---------------------------------------------------------------------------

create or replace function public.can_message(p_from uuid, p_to uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select p_from is not null and p_to is not null and p_from <> p_to
    and not exists (
      select 1 from public.member_blocks b
      where (b.blocker_id = p_to and b.blocked_id = p_from)
         or (b.blocker_id = p_from and b.blocked_id = p_to)
    )
    and (
      exists (
        select 1 from public.connections c
        where c.ended_at is null
          and c.member_low = least(p_from, p_to)
          and c.member_high = greatest(p_from, p_to)
      )
      or exists (
        select 1
        from public.engagement_participants a
        join public.engagement_participants b on b.engagement_id = a.engagement_id
        join public.engagements e on e.id = a.engagement_id
        where a.member_id = p_from and b.member_id = p_to
          and a.left_at is null and b.left_at is null
          and e.state in ('matched','active','delivered','closed')
      )
      or coalesce((select mp.inbound_open from public.messaging_preferences mp where mp.member_id = p_to), false)
    );
$fn$;

comment on function public.can_message(uuid,uuid) is
  'Zero discovery by default. Messaging opens on an accepted connection, a shared engagement at matched or beyond, or an inbox the recipient deliberately opened. A block overrides all three, in both directions.';

create or replace function public.messages_enforce_gate()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare v_other uuid; v_kind text;
begin
  select kind into v_kind from public.threads where id = new.thread_id;

  if not exists (
    select 1 from public.thread_participants p
    where p.thread_id = new.thread_id and p.member_id = new.sender_id and p.left_at is null
  ) then
    raise exception 'sender is not a participant in this thread' using errcode = 'insufficient_privilege';
  end if;

  if v_kind = 'direct' then
    select p.member_id into v_other from public.thread_participants p
    where p.thread_id = new.thread_id and p.member_id <> new.sender_id and p.left_at is null limit 1;
    if v_other is not null and not public.can_message(new.sender_id, v_other) then
      raise exception 'messaging is not open between these members' using errcode = 'insufficient_privilege';
    end if;
  end if;

  update public.threads set last_message_at = now() where id = new.thread_id;
  return new;
end;
$fn$;

create trigger messages_gate before insert on public.messages
  for each row execute function public.messages_enforce_gate();

-- Accepting a request establishes the connection.
create or replace function public.connection_requests_accept()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.state = 'accepted' and old.state = 'pending' then
    insert into public.connections (member_low, member_high, source)
    values (least(new.from_member,new.to_member), greatest(new.from_member,new.to_member), 'request')
    on conflict do nothing;
  end if;
  return new;
end;
$fn$;

create trigger cr_accept after update of state on public.connection_requests
  for each row execute function public.connection_requests_accept();

-- A matched engagement gets its thread, at the same moment identities are revealed.
create or replace function public.engagements_open_thread()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare v_thread uuid;
begin
  if new.state = 'matched' and old.state is distinct from 'matched' then
    insert into public.threads (kind, engagement_id, subject)
    values ('engagement', new.id, new.title)
    on conflict do nothing
    returning id into v_thread;

    if v_thread is not null then
      insert into public.thread_participants (thread_id, member_id)
      select v_thread, p.member_id from public.engagement_participants p
      where p.engagement_id = new.id and p.left_at is null
      on conflict do nothing;

      insert into public.thread_participants (thread_id, member_id)
      values (v_thread, new.opened_by)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$fn$;

create trigger engagements_thread after update of state on public.engagements
  for each row execute function public.engagements_open_thread();

-- Retention. Inactive threads age out at the member's stated period.
create or replace function public.purge_inactive_threads()
returns integer language sql security definer set search_path = '' as $fn$
  with cutoff as (
    select t.id
    from public.threads t
    where t.state = 'active'
      and coalesce(t.last_message_at, t.created_at)
          < now() - (coalesce((
              select min(mp.retention_months) from public.thread_participants tp
              join public.messaging_preferences mp on mp.member_id = tp.member_id
              where tp.thread_id = t.id
            ), 36) || ' months')::interval
  ), archived as (
    update public.threads set state = 'archived', archived_at = now()
    where id in (select id from cutoff) returning 1
  ) select count(*)::integer from archived;
$fn$;

comment on function public.purge_inactive_threads() is
  'Thirty-six months of inactivity by default, or the shortest period any participant has chosen. Archives rather than deletes so a report filed before the cutoff still has its excerpt.';

-- ---------------------------------------------------------------------------
-- policies
-- ---------------------------------------------------------------------------

do $rls$
declare t text;
begin
  foreach t in array array[
    'messaging_preferences','member_blocks','connections','connection_requests',
    'threads','thread_participants','messages','message_attachments','message_reactions','reports'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$rls$;

grant select, insert, update on public.messaging_preferences to authenticated;
grant select, insert, delete on public.member_blocks to authenticated;
grant select on public.connections to authenticated;
grant select, insert, update on public.connection_requests to authenticated;
grant select on public.threads to authenticated;
grant select, update on public.thread_participants to authenticated;
grant select, insert, update on public.messages to authenticated;
grant select, insert on public.message_attachments to authenticated;
grant select, insert, delete on public.message_reactions to authenticated;
grant select, insert on public.reports to authenticated;

create policy mp_own on public.messaging_preferences for select to authenticated
  using (member_id = public.current_member_id());
create policy mp_insert_own on public.messaging_preferences for insert to authenticated
  with check (member_id = public.current_member_id());
create policy mp_update_own on public.messaging_preferences for update to authenticated
  using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());

create policy blocks_own on public.member_blocks for select to authenticated
  using (blocker_id = public.current_member_id());
create policy blocks_insert_own on public.member_blocks for insert to authenticated
  with check (blocker_id = public.current_member_id());
create policy blocks_delete_own on public.member_blocks for delete to authenticated
  using (blocker_id = public.current_member_id());

create policy connections_own on public.connections for select to authenticated
  using (member_low = public.current_member_id() or member_high = public.current_member_id());

create policy cr_select_party on public.connection_requests for select to authenticated
  using (from_member = public.current_member_id() or to_member = public.current_member_id());
create policy cr_insert_own on public.connection_requests for insert to authenticated
  with check (
    from_member = public.current_member_id()
    and state = 'pending'
    and not exists (
      select 1 from public.member_blocks b
      where b.blocker_id = connection_requests.to_member and b.blocked_id = connection_requests.from_member
    )
  );
create policy cr_update_party on public.connection_requests for update to authenticated
  using (from_member = public.current_member_id() or to_member = public.current_member_id())
  with check (from_member = public.current_member_id() or to_member = public.current_member_id());

create policy threads_participant on public.threads for select to authenticated
  using (exists (select 1 from public.thread_participants p
                 where p.thread_id = threads.id and p.member_id = public.current_member_id() and p.left_at is null));

create policy tp_participant on public.thread_participants for select to authenticated
  using (exists (select 1 from public.thread_participants p2
                 where p2.thread_id = thread_participants.thread_id
                   and p2.member_id = public.current_member_id() and p2.left_at is null));
create policy tp_update_own on public.thread_participants for update to authenticated
  using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());

create policy messages_participant on public.messages for select to authenticated
  using (exists (select 1 from public.thread_participants p
                 where p.thread_id = messages.thread_id and p.member_id = public.current_member_id() and p.left_at is null));
create policy messages_insert_own on public.messages for insert to authenticated
  with check (sender_id = public.current_member_id() and state = 'sent');
create policy messages_update_own on public.messages for update to authenticated
  using (sender_id = public.current_member_id()) with check (sender_id = public.current_member_id());

create policy ma_participant on public.message_attachments for select to authenticated
  using (exists (select 1 from public.messages m join public.thread_participants p on p.thread_id = m.thread_id
                 where m.id = message_attachments.message_id and p.member_id = public.current_member_id() and p.left_at is null));
create policy ma_insert_own on public.message_attachments for insert to authenticated
  with check (exists (select 1 from public.messages m where m.id = message_attachments.message_id and m.sender_id = public.current_member_id()));

create policy mr_participant on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m join public.thread_participants p on p.thread_id = m.thread_id
                 where m.id = message_reactions.message_id and p.member_id = public.current_member_id() and p.left_at is null));
create policy mr_insert_own on public.message_reactions for insert to authenticated
  with check (member_id = public.current_member_id());
create policy mr_delete_own on public.message_reactions for delete to authenticated
  using (member_id = public.current_member_id());

create policy reports_own on public.reports for select to authenticated
  using (reporter_id = public.current_member_id());
create policy reports_insert_own on public.reports for insert to authenticated
  with check (reporter_id = public.current_member_id() and state = 'open');
