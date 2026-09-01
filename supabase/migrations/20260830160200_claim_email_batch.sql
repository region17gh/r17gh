create or replace function public.ensure_unsubscribe_token(p_member uuid)
returns text language plpgsql security definer set search_path = '' as $fn$
declare v_token text;
begin
  select token into v_token from public.unsubscribe_tokens
   where member_id = p_member and scope = 'all' and used_at is null limit 1;
  if v_token is null then
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    insert into public.unsubscribe_tokens (token, member_id, scope) values (v_token, p_member, 'all');
  end if;
  return v_token;
end;
$fn$;

create or replace function public.claim_email_batch(p_limit integer default 100)
returns table (
  delivery_id uuid,
  member_id uuid,
  email text,
  display_name text,
  timezone text,
  digest_key text,
  kind text,
  title text,
  body text,
  url_path text,
  occurred_at timestamptz,
  unsubscribe_token text
)
language plpgsql security definer set search_path = '' as $fn$
begin
  -- Suppressed addresses never leave the queue as sendable. Deliverability is a
  -- shared reputation and one ignored complaint degrades every member's mail.
  update public.notification_deliveries d
     set state = 'suppressed', error = 'address suppressed'
    from public.members m
   where d.member_id = m.id
     and d.channel_slug = 'email'
     and d.state = 'queued'
     and (
       m.email is null
       or exists (select 1 from public.email_suppressions s where s.address = lower(m.email::text))
     );

  return query
  with due as (
    select d.id
    from public.notification_deliveries d
    where d.channel_slug = 'email'
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
  select cl.id,
         cl.member_id,
         lower(m.email::text),
         coalesce(nullif(btrim(m.display_name), ''), nullif(btrim(m.first_name), ''), 'there'),
         coalesce(m.timezone, 'UTC'),
         cl.digest_key,
         n.kind, n.title, n.body, n.url_path, n.created_at,
         public.ensure_unsubscribe_token(cl.member_id)
  from claimed cl
  join public.notifications n on n.id = cl.notification_id
  join public.members m on m.id = cl.member_id
  order by cl.member_id, coalesce(cl.digest_key, ''), n.created_at;
end;
$fn$;

comment on function public.claim_email_batch(integer) is
  'Everything the worker needs in one call: claimed rows, recipient, digest grouping and a reusable unsubscribe token. Suppressed addresses are drained to the suppressed state before claiming, so the worker never has to know the suppression rules.';

create or replace function public.consume_unsubscribe_token(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v record;
begin
  select * into v from public.unsubscribe_tokens where token = p_token;
  if v.token is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown token');
  end if;

  if v.scope = 'all' then
    insert into public.notification_settings (member_id, email_enabled)
    values (v.member_id, false)
    on conflict (member_id) do update set email_enabled = false, updated_at = now();
  else
    insert into public.notification_preferences (member_id, kind_slug, channel_slug, enabled)
    values (v.member_id, v.kind_slug, 'email', false)
    on conflict (member_id, kind_slug, channel_slug) do update set enabled = false, updated_at = now();
  end if;

  update public.notification_deliveries
     set state = 'cancelled'
   where member_id = v.member_id and channel_slug = 'email' and state = 'queued'
     and (v.scope = 'all' or notification_id in (
           select id from public.notifications where kind = v.kind_slug));

  update public.unsubscribe_tokens set used_at = now() where token = p_token;

  return jsonb_build_object('ok', true, 'scope', v.scope, 'kind', v.kind_slug);
end;
$fn$;

comment on function public.consume_unsubscribe_token(text) is
  'One-click unsubscribe under RFC 8058. Turning email off never touches essential kinds, which resolve_delivery forces through regardless.';
