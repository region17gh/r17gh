-- The dashboard is the only surface where the ladder is visible as a ladder.
-- Not a feed: a work queue with the member's name on it. One call returns
-- everything it shows, so the page makes a single round trip.

create or replace function public.renew_declaration(p_declaration uuid, p_months integer default 18)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_member uuid; d record;
begin
  v_member := public.current_member_id();
  select * into d from public.declarations where id = p_declaration and member_id = v_member;
  if d.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not yours');
  end if;

  update public.declarations
     set available_from  = current_date,
         available_until = (current_date + (greatest(1, least(coalesce(p_months,18),24)) || ' months')::interval)::date,
         state = 'active',
         withdrawn_at = null
   where id = p_declaration;

  -- A renewed declaration re-enters the graph, so it should be matched against
  -- everything published while it was dormant.
  perform public.generate_matches_for_declaration(p_declaration);

  return jsonb_build_object('ok', true, 'until',
    (select available_until from public.declarations where id = p_declaration));
end;
$fn$;

comment on function public.renew_declaration(uuid,integer) is
  'One tap. Re-dates the window, reactivates, and re-runs matching so a lapsed declaration catches up on anything posted while it slept.';

create or replace function public.withdraw_declaration(p_declaration uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_member uuid;
begin
  v_member := public.current_member_id();
  update public.declarations
     set state = 'withdrawn', withdrawn_at = now()
   where id = p_declaration and member_id = v_member;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not yours'); end if;
  return jsonb_build_object('ok', true);
end;
$fn$;

create or replace function public.member_dashboard()
returns jsonb language sql stable security invoker set search_path = '' as $fn$
  with me as (select public.current_member_id() as id),
  decls as (
    select d.*, p.name as place_name, pw.name as pathway_name,
           (d.available_until - current_date) as days_left
    from public.declarations d
    join public.places p on p.slug = d.place_slug
    join public.pathways pw on pw.slug = d.pathway_slug
    where d.member_id = (select id from me) and d.state <> 'withdrawn'
  ),
  engs as (
    select e.id, e.title, e.state, e.place_slug, pl.name as place_name,
           e.opened_at, e.review_due_at, e.held_until, e.redirect_note,
           es.name as state_name, es.sort_order,
           (select count(*) from public.engagement_participants ep
             where ep.engagement_id = e.id and ep.left_at is null) as participants
    from public.engagements e
    join public.engagement_states es on es.slug = e.state
    join public.places pl on pl.slug = e.place_slug
    where e.opened_by = (select id from me)
       or exists (select 1 from public.engagement_participants ep
                   where ep.engagement_id = e.id and ep.member_id = (select id from me) and ep.left_at is null)
  ),
  watching as (
    select s.subject_id as slug, p.name, p.type_slug, p.url_path, s.notify,
           (select count(*) from public.needs n
             where n.state='published' and n.place_slug in (select ds.slug from public.place_descendants(s.subject_id) ds)) as postings,
           (select max(a.occurred_at) from public.activity_events a
             where a.place_slug in (select ds.slug from public.place_descendants(s.subject_id) ds)) as last_activity
    from public.subscriptions s
    join public.places p on p.slug = s.subject_id
    where s.member_id = (select id from me) and s.subject_kind = 'place' and s.state = 'active'
  ),
  matches as (
    select m.id, m.score, m.reasons, m.state, m.created_at,
           n.title, n.direction, n.place_slug, pl.name as place_name, n.sector_slug,
           d.headline as your_declaration
    from public.matches m
    join public.needs n on n.id = m.need_id
    join public.places pl on pl.slug = n.place_slug
    join public.declarations d on d.id = m.declaration_id
    where m.member_id = (select id from me) and m.state in ('new','notified','viewed')
  ),
  perks as (
    select o.id, o.slug, o.title, o.summary, o.type_slug, o.starts_at,
           o.list_price_amount, o.list_price_currency, k.perk_kind, k.discount_percent,
           pl.name as place_name
    from public.offerings o
    left join public.places pl on pl.slug = o.place_slug
    left join public.offering_perks k on k.offering_id = o.id
    where o.state = 'published'
      and (o.place_slug is null or exists (
        select 1 from public.subscriptions s
        where s.member_id = (select id from me) and s.subject_kind='place' and s.state='active'
          and o.place_slug in (select ds.slug from public.place_descendants(s.subject_id) ds)))
    order by o.starts_at nulls last limit 6
  )
  select jsonb_build_object(
    'member_id', (select id from me),
    'ladder', jsonb_build_object(
      'watching',   (select count(*) from watching),
      'declared',   (select count(*) from decls where state='active'),
      'dormant',    (select count(*) from decls where state='dormant'),
      'expressed',  (select count(*) from engs where state='expressed'),
      'in_review',  (select count(*) from engs where state='in-review'),
      'matched',    (select count(*) from engs where state='matched'),
      'active',     (select count(*) from engs where state='active'),
      'delivered',  (select count(*) from engs where state in ('delivered','closed'))),
    'attention', jsonb_build_object(
      'unread_notifications', (select count(*) from public.notifications
                                where member_id=(select id from me) and state='unread'),
      'new_matches', (select count(*) from matches where state in ('new','notified')),
      'lapsing_soon', (select count(*) from decls where state='active' and days_left <= 30),
      'awaiting_response', (select count(*) from engs where state in ('expressed','in-review'))),
    'declarations', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'direction', direction, 'headline', headline, 'pathway', pathway_name,
        'sector', sector_slug, 'place', place_slug, 'place_name', place_name,
        'visibility', visibility, 'state', state,
        'available_until', available_until, 'days_left', days_left,
        'lapsing', state='active' and days_left <= 30) order by state, days_left)
      from decls), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'title', title, 'direction', direction, 'place', place_slug,
        'place_name', place_name, 'sector', sector_slug, 'score', score,
        'reasons', reasons, 'because', your_declaration, 'state', state) order by created_at desc)
      from matches), '[]'::jsonb),
    'engagements', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'title', title, 'state', state, 'state_name', state_name,
        'place', place_slug, 'place_name', place_name, 'participants', participants,
        'opened_at', opened_at, 'review_due_at', review_due_at,
        'held_until', held_until, 'note', redirect_note) order by sort_order, opened_at)
      from engs), '[]'::jsonb),
    'watching', coalesce((select jsonb_agg(jsonb_build_object(
        'slug', slug, 'name', name, 'type', type_slug, 'url_path', url_path,
        'notify', notify, 'postings', postings, 'last_activity', last_activity)
        order by last_activity desc nulls last)
      from watching), '[]'::jsonb),
    'perks', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'slug', slug, 'title', title, 'summary', summary, 'type', type_slug,
        'starts_at', starts_at, 'place_name', place_name,
        'list_price', list_price_amount, 'currency', list_price_currency,
        'perk_kind', perk_kind, 'discount_percent', discount_percent))
      from perks), '[]'::jsonb)
  );
$fn$;

comment on function public.member_dashboard() is
  'Everything the dashboard shows, in one call. security invoker, so RLS decides what the caller may see and the function cannot leak past it.';

revoke all on function public.member_dashboard() from public, anon;
grant execute on function public.member_dashboard() to authenticated, service_role;
revoke all on function public.renew_declaration(uuid,integer) from public, anon;
grant execute on function public.renew_declaration(uuid,integer) to authenticated, service_role;
revoke all on function public.withdraw_declaration(uuid) from public, anon;
grant execute on function public.withdraw_declaration(uuid) to authenticated, service_role;
