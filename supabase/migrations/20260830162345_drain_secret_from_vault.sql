-- The drain secret now lives in exactly one place: the vault. The edge function
-- asks the database whether a presented token is valid rather than holding a
-- copy, so rotating it is one update and no redeploy.
create or replace function public.verify_drain_secret(p_token text)
returns boolean language plpgsql security definer set search_path = '' as $fn$
declare v_secret text; v_ok boolean := false; i integer; diff integer := 0;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'drain_secret';
  if v_secret is null or p_token is null then return false; end if;
  if length(v_secret) <> length(p_token) then return false; end if;
  for i in 1..length(v_secret) loop
    diff := diff # (ascii(substr(v_secret,i,1)) # ascii(substr(p_token,i,1)));
  end loop;
  v_ok := (diff = 0);
  return v_ok;
end;
$fn$;

comment on function public.verify_drain_secret(text) is
  'Constant-time comparison against the vault. Called by the notifier edge function so the secret never has to be duplicated into a function environment variable.';

revoke all on function public.verify_drain_secret(text) from public, anon, authenticated;
grant execute on function public.verify_drain_secret(text) to service_role;
