-- One Resend. Two send paths remain, because they do different jobs:
--   resend.server.ts  designed transactional mail the app sends itself
--   notifier          the preference-driven queue: digests, cadence, quiet hours
-- What must not be duplicated is the suppression list, the credential and the
-- from-address. The vault is the only store both paths can reach, so it becomes
-- the single source for all three.

create or replace function public.is_suppressed(p_address text)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from public.email_suppressions s
    where s.address = lower(btrim(p_address))
  );
$fn$;

comment on function public.is_suppressed(text) is
  'Checked by every send path before the transport is called. A suppression list that only covers half the outbound mail is not a suppression list.';

revoke all on function public.is_suppressed(text) from public, anon, authenticated;
grant execute on function public.is_suppressed(text) to service_role;

-- The app reads the same credentials the notifier does, so rotation is one
-- statement rather than two systems drifting apart.
comment on function public.get_notifier_config() is
  'Single source for the Resend credentials and the from-address. Read by the notifier edge function and by resend.server.ts through the service-role client. Rotate with set_notifier_secret; both paths pick it up on their next send.';

select public.set_notifier_secret('mail_from', 'Region 17 <notifications@r17gh.com>');
