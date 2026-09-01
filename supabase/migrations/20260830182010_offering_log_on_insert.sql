-- An offering inserted straight into the published state must log and notify
-- exactly as one that is published by an update. Firing on update only meant a
-- perk created in one step was invisible to the ledger and to every watcher.
create or replace function public.trg_log_offering()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare v_became_published boolean;
begin
  v_became_published := new.state = 'published'
    and (tg_op = 'INSERT' or old.state is distinct from 'published');

  if v_became_published then
    perform public.log_activity('offering.published', new.published_by, 'offering', new.id::text, new.place_slug,
      jsonb_build_object('type', new.type_slug, 'title', new.title, 'audience', new.audience));
    perform public.notify_watchers_of_offering(new.id);
  end if;
  return null;
end;
$fn$;

drop trigger if exists offerings_log on public.offerings;

create trigger offerings_log
  after insert or update of state on public.offerings
  for each row execute function public.trg_log_offering();

revoke all on function public.notify_watchers_of_offering(uuid) from public, anon, authenticated;
grant execute on function public.notify_watchers_of_offering(uuid) to service_role;
grant execute on function public.member_perks(integer) to anon, authenticated, service_role;
