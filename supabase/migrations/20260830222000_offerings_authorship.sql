-- Nothing publishes without a named human behind it, including a scheduled
-- publish. The publisher of a scheduled offering is whoever composed and
-- scheduled it, so the composer needs to record its author.
alter table public.offerings
  add column created_by uuid references public.members (id) on delete restrict,
  add column scheduled_by uuid references public.members (id) on delete restrict;

comment on column public.offerings.scheduled_by is
  'Who set publish_at. Becomes published_by when the scheduler fires, so a scheduled publication is as attributable as a manual one.';

create or replace function public.publish_scheduled_offerings()
returns integer language plpgsql security definer set search_path = '' as $fn$
declare v_published integer := 0; v_closed integer := 0; r record;
begin
  for r in
    select o.id, coalesce(o.scheduled_by, o.created_by) as author
    from public.offerings o
    where o.state = 'draft' and o.publish_at is not null and o.publish_at <= now()
      and coalesce(o.scheduled_by, o.created_by) is not null
      and not exists (
        select 1 from public.offering_media om join public.media_assets m on m.id = om.media_id
        where om.offering_id = o.id and not m.is_cleared)
  loop
    update public.offerings
       set state = 'published', published_at = now(), published_by = r.author
     where id = r.id;
    v_published := v_published + 1;
  end loop;

  update public.offerings set state = 'closed'
   where state = 'published' and unpublish_at is not null and unpublish_at <= now();
  get diagnostics v_closed = row_count;

  return v_published + v_closed;
end;
$fn$;

comment on function public.publish_scheduled_offerings() is
  'Runs every ten minutes. Skips anything carrying uncleared media, and anything with no author to attribute the publication to, rather than failing the batch.';
