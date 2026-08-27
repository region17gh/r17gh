-- O-003. Regional capitals confirmed 27 Aug 2026 from Ghanaian sources supplied by the team.
-- Note on naming: the current region is BONO (capital Sunyani). "Brong Ahafo" is the
-- pre-2019 name, and it still appears in circulating reference tables. The 2018
-- referendum split Brong-Ahafo into Bono, Bono East and Ahafo. Our data already uses
-- the correct current names; do not let the older label propagate back in.

alter table public.ghana_regions add column if not exists capital text;

update public.ghana_regions set capital = v.capital
from (values
  ('ahafo','Goaso'), ('ashanti','Kumasi'), ('bono','Sunyani'), ('bono-east','Techiman'),
  ('central','Cape Coast'), ('eastern','Koforidua'), ('greater-accra','Accra'),
  ('north-east','Nalerigu'), ('northern','Tamale'), ('oti','Dambai'),
  ('savannah','Damongo'), ('upper-east','Bolgatanga'), ('upper-west','Wa'),
  ('volta','Ho'), ('western','Sekondi-Takoradi'), ('western-north','Sefwi Wiawso')
) AS v(slug, capital)
where public.ghana_regions.slug = v.slug;

comment on column public.ghana_regions.capital is
  'Regional capital. Confirmed 27 Aug 2026 against Ghanaian reference sources. VERIFIED, not estimate.';
