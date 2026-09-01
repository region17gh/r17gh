-- SECURITY DEFINER functions bypass RLS. Postgres grants EXECUTE to PUBLIC by
-- default, so any of these left open is a hole. Worker- and scheduler-facing
-- functions are restricted to service_role; the rest keep only the access their
-- own logic can defend.

do $lock$
declare f text;
begin
  foreach f in array array[
    'public.claim_email_batch(integer)',
    'public.claim_due_deliveries(text,integer)',
    'public.mark_delivery_sent(uuid,text,text)',
    'public.mark_delivery_failed(uuid,text)',
    'public.suppress_address(text,text,text)',
    'public.ensure_unsubscribe_token(uuid)',
    'public.consume_unsubscribe_token(text)',
    'public.resolve_delivery(uuid,text,text)',
    'public.next_send_time(uuid,text)',
    'public.purge_inactive_threads()',
    'public.expire_declarations()',
    'public.generate_matches_for_need(uuid)',
    'public.generate_matches_for_declaration(uuid)',
    'public.match_candidates_for_need(uuid)',
    'public.notify_watchers_of_need(uuid)',
    'public.log_activity(text,uuid,text,text,text,jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;

  -- can_message would otherwise let anyone probe the relationship graph.
  revoke all on function public.can_message(uuid,uuid) from public, anon;
  grant execute on function public.can_message(uuid,uuid) to authenticated, service_role;

  -- Read helpers that are safe to expose: they reveal only published structure.
  grant execute on function public.place_descendants(text) to anon, authenticated, service_role;
  grant execute on function public.places_on_same_chain(text,text) to anon, authenticated, service_role;
  grant execute on function public.place_impact(text,integer) to anon, authenticated, service_role;
  grant execute on function public.place_activity(text,integer) to anon, authenticated, service_role;
  grant execute on function public.region_payload(text) to anon, authenticated, service_role;
  grant execute on function public.can_submit_need(text) to authenticated, service_role;
end;
$lock$;
