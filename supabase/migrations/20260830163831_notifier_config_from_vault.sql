-- Every notifier secret now lives in the vault. No edge function environment
-- variables, no dashboard step, and rotating any of them is one SQL statement
-- with no redeploy.
create or replace function public.get_notifier_config()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select jsonb_build_object(
    'resend_api_key',        (select decrypted_secret from vault.decrypted_secrets where name = 'resend_api_key'),
    'resend_webhook_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'resend_webhook_secret'),
    'mail_from',    coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'mail_from'),
                             'Region 17 <notifications@r17gh.com>'),
    'app_origin',   coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'app_origin'),
                             'https://r17gh.com')
  );
$fn$;

comment on function public.get_notifier_config() is
  'Read once per invocation by the notifier edge function. service_role only: it returns live credentials.';

revoke all on function public.get_notifier_config() from public, anon, authenticated;
grant execute on function public.get_notifier_config() to service_role;

-- Set or rotate any notifier secret in one call.
create or replace function public.set_notifier_secret(p_name text, p_value text)
returns text language plpgsql security definer set search_path = '' as $fn$
declare v_id uuid;
begin
  if p_name not in ('resend_api_key','resend_webhook_secret','mail_from','app_origin','notifier_url','drain_secret') then
    raise exception 'unknown notifier secret %', p_name using errcode = 'check_violation';
  end if;

  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then
    perform vault.create_secret(p_value, p_name, 'Notifier configuration');
    return 'created ' || p_name;
  else
    perform vault.update_secret(v_id, p_value, p_name, 'Notifier configuration');
    return 'updated ' || p_name;
  end if;
end;
$fn$;

comment on function public.set_notifier_secret(text,text) is
  'Creates or rotates a notifier secret in the vault. Restricted to the closed list of names the notifier actually reads.';

revoke all on function public.set_notifier_secret(text,text) from public, anon, authenticated;
grant execute on function public.set_notifier_secret(text,text) to service_role;

-- Shows what is configured without ever revealing a value.
create or replace function public.notifier_config_status()
returns table (secret_name text, is_set boolean, chars integer) language sql stable security definer set search_path = '' as $fn$
  select n.name,
         s.decrypted_secret is not null and length(btrim(coalesce(s.decrypted_secret,''))) > 0,
         coalesce(length(s.decrypted_secret), 0)
  from (values ('notifier_url'),('drain_secret'),('resend_api_key'),
               ('resend_webhook_secret'),('mail_from'),('app_origin')) as n(name)
  left join vault.decrypted_secrets s on s.name = n.name
  order by n.name;
$fn$;

revoke all on function public.notifier_config_status() from public, anon;
grant execute on function public.notifier_config_status() to authenticated, service_role;
