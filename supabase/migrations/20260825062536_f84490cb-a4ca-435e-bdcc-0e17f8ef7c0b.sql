CREATE OR REPLACE FUNCTION public.enforce_member_rules()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE
  earliest date;
  erasing boolean := false;
BEGIN
  NEW.class_year := EXTRACT(YEAR FROM NEW.joined_at)::integer;

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
    IF EXISTS (SELECT 1 FROM public.reserved_handles r WHERE r.handle = NEW.handle) THEN
      RAISE EXCEPTION 'That handle is reserved.' USING ERRCODE = 'check_violation';
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
      IF OLD.handle IS NOT NULL AND OLD.handle_changed_at IS NOT NULL THEN
        RAISE EXCEPTION 'A handle may be changed once only.' USING ERRCODE = 'check_violation';
      END IF;
      IF OLD.handle IS NOT NULL THEN
        NEW.handle_changed_at := now();
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
END; $$;