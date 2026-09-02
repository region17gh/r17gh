-- 20260902204231_reserved_slug_guard_completions.sql
--
-- STATUS: ALREADY APPLIED to production idmxottsjqeiatgiudvt on 2026-09-02,
-- recorded in supabase_migrations.schema_migrations as version 20260902204231.
-- This file exists to restore repo/production parity for drift-detection CI.
-- Idempotent (on conflict do nothing); safe to replay, no replay needed.
--
-- D-078 addendum. Completes the reserved namespace seeded by 20260902203812.
--
-- Three gaps, found by the Claude Code build-check on 2026-09-02:
--
--   1. `traditional` is a synthetic root segment. public.places holds
--      agotime (type_slug 'traditional-area') at url_path 'traditional/agotime',
--      so `traditional` appears as a top-level URL segment with no place row
--      backing it. Unreserved, a future place slug could shadow it.
--   2. `home` and `declare` are live routes ($locale/home.tsx, $locale/declare.tsx)
--      that the original seed never saw. `mcp`, `favicon`, `well-known` likewise.
--   3. Under D-078 a flat place namespace makes /fr/volta ambiguous once a second
--      language ships: locale fr + region volta, or region fr + district volta.
--      Two-letter ISO 639-1 codes are already blocked by places_slug_min_length_chk.
--      Three-letter ISO 639-3 codes are not. Reserving them closes the ambiguity
--      structurally rather than relying on nobody naming a district 'fra'.
--
-- POST-APPLY VERIFICATION (direct query against production, not a success response):
--     reserved_slugs rows ....... 193 (was 69)
--     live place collisions ..... 0
--     distinct url_path roots ... 18 (16 regions + ghana + traditional)

insert into public.reserved_slugs (word, reason) values
  ('traditional','Synthetic root segment for traditional-area places'),
  ('home','Live route $locale/home.tsx, member dashboard'),
  ('declare','Live route $locale/declare.tsx'),
  ('mcp','Preview and tooling route namespace'),
  ('favicon','Site icon file'),
  ('well-known','RFC 8615 well-known URI namespace'),
  ('sign-in','Reserved alias of signin'),
  ('sign-out','Reserved alias of signout'),
  ('district','Place-type collection word'),
  ('districts','Place-type collection word'),
  ('place','Place-type collection word'),
  ('places','Place-type collection word'),
  ('region','Place-type collection word, singular of reserved regions'),
  ('town','Place-type collection word'),
  ('city','Place-type collection word'),
  ('community','Place-type collection word')
on conflict (word) do nothing;

-- ISO 639-3 three-letter language codes. Two-letter ISO 639-1 codes need no
-- entry: places_slug_min_length_chk already makes a slug shorter than three
-- characters impossible.
insert into public.reserved_slugs (word, reason)
select code, 'ISO 639-3 language code, reserved as a future locale prefix'
from unnest(array[
  'aar','abk','afr','amh','ara','aze','bam','ben','bul','cat','ces','dan','deu','ell','eng',
  'epo','est','eus','fas','fin','fra','ful','gla','gle','glg','guj','hat','heb','hin',
  'hrv','hun','hye','ibo','ind','isl','ita','jav','jpn','kat','kaz','khm','kin','kir','kor',
  'kur','lao','lav','lin','lit','lug','mal','mar','mkd','mlg','mlt','mon','mri','msa','mya',
  'nde','nep','nld','nno','nob','nor','nya','oci','orm','pan','pol','por','pus','que','ron',
  'run','rus','sag','sin','slk','slv','sna','som','sot','spa','sqi','srp','ssw','swe','tam',
  'tel','tgk','tgl','tha','tir','tsn','tso','tuk','tur','ukr','urd','uzb','ven','vie','wol',
  'xho','yid','zho','zul'
]) as code
on conflict (word) do nothing;
