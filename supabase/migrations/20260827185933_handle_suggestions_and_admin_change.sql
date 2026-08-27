-- O-027. Deterministic suggestions for the join flow, and a staff-forced change
-- that does not consume the member's one allowed change.

create or replace function public.slug_part(t text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select regexp_replace(
           translate(lower(t),
             'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
             'aaaaaaceeeeiiiinooooouuuuyy'),
           '[^a-z0-9]', '', 'g');
$$;

create or replace function public.handle_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = 'public', 'extensions'
as $$
  select candidate ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$'
     and not exists (select 1 from public.members m where m.handle = candidate::citext)
     and not exists (select 1 from public.reserved_handles r
                      where r.norm = public.normalize_handle(candidate));
$$;

comment on function public.handle_available(text) is
  'True if a candidate handle passes format, is unclaimed, and does not exactly match a reserved normalized form. Containment matches are deliberately available here: they are flagged for review after the fact, never blocked at signup.';

-- Deterministic, not generative. Runs inside the join flow, so it must be instant,
-- free, and incapable of proposing something that turns out to be unavailable.
-- Every option returned has been checked against the live register.
create or replace function public.suggest_handles(
  first_name text,
  last_name  text,
  wanted     text default null,
  want       int  default 6
)
returns table (handle text, basis text)
language plpgsql
stable
security definer
set search_path = 'public', 'extensions'
as $function$
DECLARE
  f     text := public.slug_part(coalesce(first_name, ''));
  l     text := public.slug_part(coalesce(last_name, ''));
  w     text := public.slug_part(coalesce(wanted, ''));
  pairs text[][];
  c     text;
  b     text;
  i     int;
  found int := 0;
BEGIN
  pairs := array[]::text[][];

  IF w <> '' THEN pairs := pairs || array[[w, 'requested']]; END IF;
  IF f <> '' THEN pairs := pairs || array[[f, 'first name']]; END IF;

  IF f <> '' AND l <> '' THEN
    pairs := pairs || array[[f || '-' || l,          'full name']];
    pairs := pairs || array[[f || l,                 'full name, joined']];
    pairs := pairs || array[[f || left(l, 1),        'first name and initial']];
    pairs := pairs || array[[f || '-' || left(l, 1), 'first name and initial']];
    pairs := pairs || array[[left(f, 1) || l,        'initial and family name']];
    pairs := pairs || array[[left(f, 1) || '-' || l, 'initial and family name']];
  END IF;

  IF l <> '' THEN pairs := pairs || array[[l, 'family name']]; END IF;

  -- Numbered fallbacks last, and only on the strongest bases, so nobody is offered
  -- a number until the readable options are genuinely gone.
  IF w <> '' THEN
    FOR i IN 2..9 LOOP pairs := pairs || array[[w || '-' || i, 'requested, numbered']]; END LOOP;
  END IF;
  IF f <> '' AND l <> '' THEN
    FOR i IN 2..9 LOOP pairs := pairs || array[[f || '-' || l || '-' || i, 'full name, numbered']]; END LOOP;
  END IF;

  FOR i IN 1 .. coalesce(array_length(pairs, 1), 0) LOOP
    c := pairs[i][1];
    b := pairs[i][2];
    CONTINUE WHEN c IS NULL OR length(c) < 3 OR length(c) > 30;
    CONTINUE WHEN EXISTS (SELECT 1 FROM unnest(array[c]) x WHERE false);
    IF public.handle_available(c) THEN
      handle := c;
      basis  := b;
      RETURN NEXT;
      found := found + 1;
      EXIT WHEN found >= want;
    END IF;
  END LOOP;

  RETURN;
END; $function$;

comment on function public.suggest_handles(text, text, text, int) is
  'Ranked, available handle suggestions built deterministically from a member''s own name. Readable options first, numbered fallbacks last. Every result is checked live, so nothing offered can already be taken or reserved.';

-- Staff-forced change, used when a review finds genuine impersonation.
-- Bypasses the once-ever rule: a member should not spend their one change on our decision.
create or replace function public.admin_change_handle(
  p_member uuid,
  p_handle citext,
  p_note   text
)
returns void
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $function$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'admin_change_handle is restricted to service_role.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM set_config('r17.admin_handle_change', 'on', true);
  UPDATE public.members SET handle = p_handle WHERE id = p_member;
  PERFORM set_config('r17.admin_handle_change', '', true);

  UPDATE public.handle_reviews
     SET status = 'actioned', reviewed_at = now(), reviewer_note = p_note
   WHERE member_id = p_member AND status = 'pending';
END; $function$;

revoke all on function public.admin_change_handle(uuid, citext, text) from public, anon, authenticated;
grant execute on function public.admin_change_handle(uuid, citext, text) to service_role;

grant execute on function public.handle_available(text) to anon, authenticated;
grant execute on function public.suggest_handles(text, text, text, int) to anon, authenticated;
grant execute on function public.normalize_handle(text) to anon, authenticated;
