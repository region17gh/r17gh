create table public.notification_channels (
  slug text primary key,
  name text not null,
  description text not null,
  is_live boolean not null default true,
  sort_order smallint not null unique
);

insert into public.notification_channels (slug, name, description, is_live, sort_order) values
  ('in_app','In app','The bell. Always delivered, never suppressed, never batched.', true, 1),
  ('email','Email','Transactional email through Resend. Batched and quiet-hours aware.', true, 2),
  ('push','Push','Mobile push. Not live yet; rows are created and left queued.', false, 3),
  ('sms','SMS','Reserved. Expensive and high-friction; only for essential kinds if ever enabled.', false, 4);

create table public.notification_kinds (
  slug           text primary key,
  name           text not null,
  description    text not null,
  is_essential   boolean not null default false,
  default_email  boolean not null default true,
  default_cadence text not null default 'immediate',
  sort_order     smallint not null unique,
  constraint nk_cadence_value check (default_cadence in ('immediate','daily','weekly'))
);

comment on column public.notification_kinds.is_essential is
  'Essential kinds ignore preferences and cannot be unsubscribed: account security, a report outcome, a response owed to the member. Everything else is opt-out under GDPR and Act 843.';

insert into public.notification_kinds (slug, name, description, is_essential, default_email, default_cadence, sort_order) values
  ('match','A match for you','A posting matched something you declared.', false, true, 'immediate', 1),
  ('watched-place','New in a place you watch','A place you follow posted something.', false, true, 'daily', 2),
  ('engagement-review','Your interest is in review','Triage has begun and a response is owed.', true, true, 'immediate', 3),
  ('engagement-matched','You have been matched','Both sides accepted. Identities are revealed.', true, true, 'immediate', 4),
  ('engagement-outcome','Engagement outcome','Redirected, held, delivered or closed.', true, true, 'immediate', 5),
  ('milestone','Milestone update','A milestone moved on work you are part of.', false, true, 'daily', 6),
  ('connection-request','Connection request','Someone asked to connect, with context attached.', false, true, 'immediate', 7),
  ('message','New message','A message in one of your threads.', false, true, 'daily', 8),
  ('report-outcome','Report outcome','A report you filed was resolved.', true, true, 'immediate', 9),
  ('account','Account and security','Sign-in, credential and account changes.', true, true, 'immediate', 10);

create table public.notification_settings (
  member_id          uuid primary key references public.members (id) on delete restrict,
  email_enabled      boolean not null default true,
  digest_hour        smallint not null default 8,
  quiet_hours_start  smallint,
  quiet_hours_end    smallint,
  updated_at         timestamptz not null default now(),
  constraint ns_digest_hour check (digest_hour between 0 and 23),
  constraint ns_quiet_start check (quiet_hours_start is null or quiet_hours_start between 0 and 23),
  constraint ns_quiet_end check (quiet_hours_end is null or quiet_hours_end between 0 and 23),
  constraint ns_quiet_pair check ((quiet_hours_start is null) = (quiet_hours_end is null))
);

comment on table public.notification_settings is
  'Per-member delivery behaviour. Times resolve in the member timezone already held on members, because a Volta posting reaching a London member at 3am is how you train people to mute you.';

create trigger ns_touch before update on public.notification_settings
  for each row execute function public.touch_updated_at();

create table public.notification_preferences (
  member_id   uuid not null references public.members (id) on delete restrict,
  kind_slug   text not null references public.notification_kinds (slug) on update cascade on delete cascade,
  channel_slug text not null references public.notification_channels (slug) on update cascade on delete cascade,
  enabled     boolean not null default true,
  cadence     text not null default 'immediate',
  updated_at  timestamptz not null default now(),
  primary key (member_id, kind_slug, channel_slug),
  constraint np_cadence_value check (cadence in ('immediate','daily','weekly'))
);

comment on table public.notification_preferences is
  'Sparse by design. A missing row means the kind default applies, so a new member has sensible behaviour with zero rows and every override is an explicit act.';

create table public.email_suppressions (
  address    text primary key,
  member_id  uuid references public.members (id) on delete set null,
  reason     text not null,
  detail     text,
  created_at timestamptz not null default now(),
  constraint es_reason_value check (reason in ('bounce','complaint','unsubscribe','manual'))
);

comment on table public.email_suppressions is
  'Deliverability is a shared reputation. One ignored complaint degrades delivery for every member, so a suppressed address is never emailed again regardless of preferences.';

create table public.unsubscribe_tokens (
  token      text primary key,
  member_id  uuid not null references public.members (id) on delete restrict,
  scope      text not null default 'all',
  kind_slug  text references public.notification_kinds (slug) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  used_at    timestamptz,
  constraint ut_scope_value check (scope in ('all','kind')),
  constraint ut_kind_required check (scope <> 'kind' or kind_slug is not null)
);

create index ut_member_idx on public.unsubscribe_tokens (member_id);

create table public.notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  member_id       uuid not null references public.members (id) on delete restrict,
  channel_slug    text not null references public.notification_channels (slug) on update cascade on delete restrict,
  state           text not null default 'queued',
  scheduled_for   timestamptz not null default now(),
  digest_key      text,
  attempts        smallint not null default 0,
  next_attempt_at timestamptz,
  claimed_at      timestamptz,
  sent_at         timestamptz,
  provider        text,
  provider_message_id text,
  error           text,
  created_at      timestamptz not null default now(),
  constraint nd_state_value check (state in ('queued','claimed','sent','failed','cancelled','suppressed')),
  constraint nd_attempts_range check (attempts between 0 and 10)
);

comment on table public.notification_deliveries is
  'The outbox. One row per notification per channel, so a failed email never loses the in-app record and a retry never double-sends. Everything a worker needs is here; the worker holds no state of its own.';
comment on column public.notification_deliveries.digest_key is
  'Groups deliveries into one email. Null means send alone.';

create unique index nd_idempotency on public.notification_deliveries (notification_id, channel_slug);
create index nd_due_idx on public.notification_deliveries (scheduled_for)
  where state = 'queued';
create index nd_digest_idx on public.notification_deliveries (member_id, digest_key) where state = 'queued';

-- ---------------------------------------------------------------------------
-- resolution: what should happen for this member, this kind, this channel
-- ---------------------------------------------------------------------------

create or replace function public.resolve_delivery(p_member uuid, p_kind text, p_channel text)
returns table (enabled boolean, cadence text)
language sql stable security definer set search_path = '' as $fn$
  select
    case
      when k.is_essential then true
      when not coalesce(s.email_enabled, true) and p_channel = 'email' then false
      else coalesce(p.enabled, case when p_channel = 'in_app' then true else k.default_email end)
    end,
    coalesce(p.cadence, k.default_cadence)
  from public.notification_kinds k
  left join public.notification_preferences p
    on p.member_id = p_member and p.kind_slug = p_kind and p.channel_slug = p_channel
  left join public.notification_settings s on s.member_id = p_member
  where k.slug = p_kind;
$fn$;

create or replace function public.next_send_time(p_member uuid, p_cadence text)
returns timestamptz language plpgsql stable security definer set search_path = '' as $fn$
declare v_tz text; v_hour smallint; v_qs smallint; v_qe smallint; v_local timestamptz; v_hr integer;
begin
  select coalesce(m.timezone,'UTC') into v_tz from public.members m where m.id = p_member;
  select coalesce(s.digest_hour, 8), s.quiet_hours_start, s.quiet_hours_end
    into v_hour, v_qs, v_qe from public.notification_settings s where s.member_id = p_member;
  v_hour := coalesce(v_hour, 8);

  if p_cadence = 'daily' then
    return (date_trunc('day', (now() at time zone v_tz)) + make_interval(days => 1, hours => v_hour)) at time zone v_tz;
  elsif p_cadence = 'weekly' then
    return (date_trunc('week', (now() at time zone v_tz)) + make_interval(days => 7, hours => v_hour)) at time zone v_tz;
  end if;

  if v_qs is not null then
    v_hr := extract(hour from (now() at time zone v_tz))::integer;
    if (v_qs < v_qe and v_hr >= v_qs and v_hr < v_qe)
       or (v_qs > v_qe and (v_hr >= v_qs or v_hr < v_qe)) then
      return (date_trunc('day', (now() at time zone v_tz))
              + make_interval(days => case when v_hr >= v_qs then 1 else 0 end, hours => v_qe)) at time zone v_tz;
    end if;
  end if;

  return now();
end;
$fn$;

comment on function public.next_send_time(uuid,text) is
  'Immediate means now unless the member is inside their quiet hours, in which case it waits for the window to close. Digests land at the member''s chosen hour in their own timezone.';

-- ---------------------------------------------------------------------------
-- fan-out
-- ---------------------------------------------------------------------------

create or replace function public.fan_out_notification()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare r record; v_when timestamptz; v_key text;
begin
  if not exists (select 1 from public.notification_kinds where slug = new.kind) then
    insert into public.notification_deliveries (notification_id, member_id, channel_slug, state)
    values (new.id, new.member_id, 'in_app', 'sent');
    return new;
  end if;

  insert into public.notification_deliveries (notification_id, member_id, channel_slug, state, sent_at)
  values (new.id, new.member_id, 'in_app', 'sent', now())
  on conflict do nothing;

  select * into r from public.resolve_delivery(new.member_id, new.kind, 'email');
  if r.enabled then
    v_when := public.next_send_time(new.member_id, r.cadence);
    v_key := case when r.cadence = 'immediate' then null
                  else r.cadence || ':' || to_char(v_when, 'YYYY-MM-DD-HH24') end;
    insert into public.notification_deliveries
      (notification_id, member_id, channel_slug, state, scheduled_for, digest_key)
    values (new.id, new.member_id, 'email', 'queued', v_when, v_key)
    on conflict do nothing;
  end if;

  return new;
end;
$fn$;

create trigger notifications_fan_out after insert on public.notifications
  for each row execute function public.fan_out_notification();

-- Reading it in the app cancels the email. Nobody wants to be told twice.
create or replace function public.cancel_email_on_read()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.state in ('read','dismissed') and old.state = 'unread' then
    update public.notification_deliveries
       set state = 'cancelled'
     where notification_id = new.id and channel_slug = 'email' and state = 'queued';
  end if;
  return new;
end;
$fn$;

create trigger notifications_cancel_email after update of state on public.notifications
  for each row execute function public.cancel_email_on_read();

-- ---------------------------------------------------------------------------
-- worker interface
-- ---------------------------------------------------------------------------

create or replace function public.claim_due_deliveries(p_channel text default 'email', p_limit integer default 100)
returns table (
  delivery_id uuid, member_id uuid, digest_key text,
  notification_id uuid, kind text, title text, body text, url_path text, created_at timestamptz
) language sql security definer set search_path = '' as $fn$
  with due as (
    select d.id
    from public.notification_deliveries d
    join public.notification_channels c on c.slug = d.channel_slug and c.is_live
    where d.channel_slug = p_channel
      and d.state = 'queued'
      and d.scheduled_for <= now()
      and (d.next_attempt_at is null or d.next_attempt_at <= now())
    order by d.scheduled_for
    limit greatest(1, least(coalesce(p_limit,100), 500))
    for update skip locked
  ), claimed as (
    update public.notification_deliveries d
       set state = 'claimed', claimed_at = now(), attempts = d.attempts + 1
     where d.id in (select id from due)
    returning d.id, d.member_id, d.digest_key, d.notification_id
  )
  select cl.id, cl.member_id, cl.digest_key, n.id, n.kind, n.title, n.body, n.url_path, n.created_at
  from claimed cl join public.notifications n on n.id = cl.notification_id
  order by cl.member_id, n.created_at;
$fn$;

comment on function public.claim_due_deliveries(text,integer) is
  'FOR UPDATE SKIP LOCKED, so several workers can drain the outbox concurrently without sending anything twice. Results arrive ordered by member so a digest is assembled in one pass.';

create or replace function public.mark_delivery_sent(p_id uuid, p_provider text, p_provider_message_id text)
returns void language sql security definer set search_path = '' as $fn$
  update public.notification_deliveries
     set state='sent', sent_at=now(), provider=p_provider, provider_message_id=p_provider_message_id, error=null
   where id=p_id;
  update public.notifications n
     set emailed_at = now()
    from public.notification_deliveries d
   where d.id = p_id and n.id = d.notification_id and n.emailed_at is null;
$fn$;

create or replace function public.mark_delivery_failed(p_id uuid, p_error text)
returns void language plpgsql security definer set search_path = '' as $fn$
declare v_attempts smallint;
begin
  select attempts into v_attempts from public.notification_deliveries where id = p_id;
  update public.notification_deliveries
     set state = case when v_attempts >= 5 then 'failed' else 'queued' end,
         error = p_error,
         next_attempt_at = now() + (power(3, least(v_attempts,5)) || ' minutes')::interval
   where id = p_id;
end;
$fn$;

comment on function public.mark_delivery_failed(uuid,text) is
  'Exponential backoff at three minutes, nine, twenty-seven and so on, giving up after five attempts. A permanently failed email never loses its in-app record.';

create or replace function public.suppress_address(p_address text, p_reason text, p_detail text default null)
returns void language sql security definer set search_path = '' as $fn$
  insert into public.email_suppressions (address, reason, detail)
  values (lower(btrim(p_address)), p_reason, p_detail)
  on conflict (address) do update set reason = excluded.reason, detail = excluded.detail;
$fn$;

comment on function public.suppress_address(text,text,text) is
  'Called from the Resend webhook on bounce and complaint, and from the one-click unsubscribe endpoint.';

do $rls$
declare t text;
begin
  foreach t in array array[
    'notification_channels','notification_kinds','notification_settings','notification_preferences',
    'email_suppressions','unsubscribe_tokens','notification_deliveries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$rls$;

grant select on public.notification_channels to anon, authenticated;
grant select on public.notification_kinds to anon, authenticated;
grant select, insert, update on public.notification_settings to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select on public.notification_deliveries to authenticated;

create policy nc_select on public.notification_channels for select to anon, authenticated using (true);
create policy nk_select on public.notification_kinds for select to anon, authenticated using (true);

create policy ns_own on public.notification_settings for select to authenticated
  using (member_id = public.current_member_id());
create policy ns_insert_own on public.notification_settings for insert to authenticated
  with check (member_id = public.current_member_id());
create policy ns_update_own on public.notification_settings for update to authenticated
  using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());

create policy np_own on public.notification_preferences for select to authenticated
  using (member_id = public.current_member_id());
create policy np_insert_own on public.notification_preferences for insert to authenticated
  with check (member_id = public.current_member_id());
create policy np_update_own on public.notification_preferences for update to authenticated
  using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());
create policy np_delete_own on public.notification_preferences for delete to authenticated
  using (member_id = public.current_member_id());

create policy nd_own on public.notification_deliveries for select to authenticated
  using (member_id = public.current_member_id());
