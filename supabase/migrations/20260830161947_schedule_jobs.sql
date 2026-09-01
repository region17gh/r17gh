create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Secrets live in the vault, never in a cron command string, because
-- cron.job is readable by anyone who can query it.
create or replace function public.call_notifier_drain()
returns bigint language plpgsql security definer set search_path = '' as $fn$
declare v_url text; v_secret text; v_request_id bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notifier_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'drain_secret';

  if v_url is null or v_secret is null then
    raise notice 'notifier_url or drain_secret not set in vault; skipping drain';
    return null;
  end if;

  select net.http_post(
    url := v_url || '/drain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-drain-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  ) into v_request_id;

  return v_request_id;
end;
$fn$;

comment on function public.call_notifier_drain() is
  'Fires the edge function that drains the email outbox. Reads its URL and shared secret from the vault so neither appears in cron.job, which is world-readable.';

revoke all on function public.call_notifier_drain() from public, anon, authenticated;

select cron.schedule('notifier-drain', '*/5 * * * *', 'select public.call_notifier_drain();');
select cron.schedule('expire-declarations', '17 3 * * *', 'select public.expire_declarations();');
select cron.schedule('purge-inactive-threads', '41 4 1 * *', 'select public.purge_inactive_threads();');
