-- O-027. Aggressive normalization for handle matching, plus a review queue.
-- Two tiers by design:
--   exact match on the normalized form  -> hard block, no appeal
--   containment of a reserved token     -> allowed, flagged for human review
-- Containment never blocks. Blocking on containment is the Scunthorpe problem and
-- would fall hardest on Ghanaian and other African names, which is unacceptable here.

create or replace function public.normalize_handle(t text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  -- 1. drop everything that is not a letter or digit (defeats h-y-p-h-e-n spacing)
  -- 2. lowercase
  -- 3. fold digit and letter lookalikes onto one representative
  -- 4. collapse runs of the same character (defeats doubling, e.g. ghaana)
  select regexp_replace(
           translate(
             lower(regexp_replace(t, '[^a-zA-Z0-9]', '', 'g')),
             '0123456789i',
             'olzeasgtbgl'
           ),
           '(.)\1+', '\1', 'g'
         );
$$;

comment on function public.normalize_handle(text) is
  'Aggressive canonical form used to compare a candidate handle against reserved_handles. Strips punctuation, folds 0/o 1/l/i 3/e 4/a 5/s 7/t 8/b 2/z 6/9/g, collapses repeated characters. Used for exact-match blocking and containment flagging only. Never stored on members.';

alter table public.reserved_handles
  add column if not exists norm text
  generated always as (public.normalize_handle(handle::text)) stored;

create index if not exists reserved_handles_norm_idx on public.reserved_handles (norm);

-- Review queue. No RLS policies by design: the absence of one is the control (D-050).
-- Reachable by service_role only.
create table if not exists public.handle_reviews (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.members(id) on delete cascade,
  handle        citext not null,
  matched       text not null,
  match_reason  text not null,
  status        text not null default 'pending'
                check (status in ('pending','cleared','actioned')),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewer_note text
);

alter table public.handle_reviews enable row level security;

create index if not exists handle_reviews_pending_idx
  on public.handle_reviews (created_at) where status = 'pending';

comment on table public.handle_reviews is
  'Handles that contain a reserved token without exactly matching one. Never blocks signup: the member holds the handle while a human reviews. Cleared or actioned under the Code of Conduct. A staff-forced change must use admin_change_handle() so it does not consume the member''s one allowed change.';

-- Flagging runs AFTER the row exists, so the FK to members is satisfiable on INSERT.
create or replace function public.flag_handle_for_review()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $function$
DECLARE
  cand text;
  hit  record;
BEGIN
  IF NEW.handle IS NULL THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.handle IS NOT DISTINCT FROM OLD.handle THEN
    RETURN NULL;
  END IF;

  cand := public.normalize_handle(NEW.handle::text);

  -- Only tokens of 5+ characters. Shorter ones (m, api, gov) appear inside
  -- ordinary names constantly and would flood the queue with noise.
  SELECT r.handle::text AS h, r.reason AS reason
    INTO hit
    FROM public.reserved_handles r
   WHERE length(r.norm) >= 5
     AND r.norm <> cand
     AND position(r.norm in cand) > 0
   ORDER BY length(r.norm) DESC
   LIMIT 1;

  IF hit IS NOT NULL THEN
    INSERT INTO public.handle_reviews (member_id, handle, matched, match_reason)
    VALUES (NEW.id, NEW.handle, hit.h, hit.reason);
  END IF;

  RETURN NULL;
END; $function$;

drop trigger if exists members_handle_review on public.members;
create trigger members_handle_review
  after insert or update of handle on public.members
  for each row execute function public.flag_handle_for_review();

-- Rewrite of the member rules trigger. Everything previously enforced is preserved.
-- Changed: the reserved check now compares normalized forms rather than literals,
-- and a service_role path can force a handle change without burning the allowance.
create or replace function public.enforce_member_rules()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $function$
DECLARE
  earliest date;
  erasing  boolean := false;
  admin_change boolean := false;
  blocked  record;
BEGIN
  NEW.class_year := EXTRACT(YEAR FROM NEW.joined_at)::integer;

  admin_change := coalesce(current_setting('r17.admin_handle_change', true), '') = 'on';

  IF TG_OP = 'UPDATE' THEN
    erasing := NEW.pseudonymized_at IS NOT NULL AND OLD.pseudonymized_at IS NULL;
  END IF;

  IF NEW.birth_year IS NOT NULL AND NEW.birth_month IS NOT NULL THEN
    earliest := (make_date(NEW.birth_year, NEW.birth_month, 1) + interval '1 month - 1 day')::date;
    IF earliest > (current_date - interval '18 years')::date THEN
      RAISE EXCEPTION 'Members must be 18 or older.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.handle IS NOT NULL THEN
    SELECT r.handle::text AS h, r.reason AS reason
      INTO blocked
      FROM public.reserved_handles r
     WHERE r.norm = public.normalize_handle(NEW.handle::text)
     LIMIT 1;

    IF blocked IS NOT NULL THEN
      IF blocked.reason = 'released' THEN
        RAISE EXCEPTION 'That handle is no longer available.' USING ERRCODE = 'check_violation';
      ELSE
        RAISE EXCEPTION 'That handle is reserved.' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.founding_member := NEW.joined_at <= (
      (SELECT value #>> '{}' FROM public.app_config WHERE key = 'founding_member_cutoff')::timestamptz);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.founding_member := OLD.founding_member;

    IF erasing THEN
      -- erasure clears the handle; pseudonymize_member retires it separately
      NULL;
    ELSIF NEW.handle IS DISTINCT FROM OLD.handle THEN
      IF admin_change THEN
        -- staff-forced change. Does not consume the member's one allowed change:
        -- they are not spending it on a decision we made.
        NEW.handle_changed_at := OLD.handle_changed_at;
      ELSE
        IF OLD.handle IS NOT NULL AND OLD.handle_changed_at IS NOT NULL THEN
          RAISE EXCEPTION 'A handle may be changed once only.' USING ERRCODE = 'check_violation';
        END IF;
        IF OLD.handle IS NOT NULL THEN
          NEW.handle_changed_at := now();
        END IF;
      END IF;

      IF OLD.handle IS NOT NULL THEN
        INSERT INTO public.reserved_handles (handle, reason)
        VALUES (OLD.handle, 'released') ON CONFLICT (handle) DO NOTHING;
      END IF;
    ELSE
      NEW.handle_changed_at := OLD.handle_changed_at;
    END IF;

    IF NEW.member_number IS DISTINCT FROM OLD.member_number
       OR NEW.credential_id IS DISTINCT FROM OLD.credential_id THEN
      RAISE EXCEPTION 'Member number and credential ID are permanent.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END; $function$;
