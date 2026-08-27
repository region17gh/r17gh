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
  seen  text[] := array[]::text[];
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
    CONTINUE WHEN c = ANY (seen);
    seen := seen || c;
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

grant execute on function public.suggest_handles(text, text, text, int) to anon, authenticated;
