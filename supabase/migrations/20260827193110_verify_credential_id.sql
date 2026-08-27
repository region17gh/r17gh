-- O-028. The check character existed and is correct, but nothing could validate it.
-- credential_id() generates; there was no inverse. O-028's own note said the point
-- was that "format alone cannot be validated later", and until now it could not.
--
-- This answers one question only: is this string a well-formed Region 17 credential?
-- It does NOT answer whether it belongs to a member in good standing. That is a
-- lookup, it discloses membership, and it is gated by consent and visibility.
-- Keeping them apart is deliberate: this one is safe to expose to anybody.

create or replace function public.verify_credential_id(candidate text)
returns table (valid boolean, join_year int, member_number int, normalized text)
language plpgsql
immutable
set search_path to 'public', 'extensions'
as $function$
DECLARE
  s        text;
  yy       text;
  nnn      text;
  chk      text;
  letters  text := 'ACDEFHJKMN';
  expected text;
BEGIN
  valid := false; join_year := NULL; member_number := NULL; normalized := NULL;

  -- Tolerant of how a human retypes it: spaces, missing or extra hyphens, any case.
  s := upper(regexp_replace(coalesce(candidate, ''), '[^A-Za-z0-9]', '', 'g'));

  IF s !~ '^R17[0-9]{8}[ACDEFHJKMN]$' THEN
    RETURN NEXT; RETURN;
  END IF;

  yy  := substr(s, 4, 2);
  nnn := substr(s, 6, 6);
  chk := substr(s, 12, 1);

  expected := substr(letters, public.damm_digit(yy || nnn) + 1, 1);

  IF chk <> expected THEN
    RETURN NEXT; RETURN;
  END IF;

  valid         := true;
  join_year     := 2000 + yy::int;
  member_number := nnn::int;
  normalized    := 'R17-' || yy || '-' || nnn || '-' || chk;
  RETURN NEXT;
END; $function$;

comment on function public.verify_credential_id(text) is
  'Checks whether a string is a well-formed Region 17 credential, using the Damm check character. Catches every single-character error and every adjacent transposition. Says nothing about whether the credential belongs to anyone: that is a separate, consent-gated lookup. Two-digit year resolves as 2000+YY, which holds until 2099.';

grant execute on function public.verify_credential_id(text) to anon, authenticated;
