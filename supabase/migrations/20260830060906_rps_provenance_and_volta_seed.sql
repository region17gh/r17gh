alter table public.region_priority_sectors
  add column data_confidence text not null default 'Estimate'
    references public.data_confidence_levels (label) on update cascade on delete restrict,
  add column reference_source text,
  add column reference_verified date,
  add column declared_by text;

comment on column public.region_priority_sectors.data_confidence is
  'Estimate means Region 17 drafted the order from published material. It becomes Sourced only when the region itself declares it.';
comment on column public.region_priority_sectors.declared_by is
  'Who declared this order. Null means Region 17 drafted it and the region has not yet confirmed.';

insert into public.region_priority_sectors
  (place_slug, sector_slug, rank, note, data_confidence, reference_source, reference_verified, declared_by)
values
  ('volta','agribusiness',1,
   'Rice, cassava, shallots, yam, oil palm, cocoa, ginger and coconut, with near-total absence of value addition. Grow24 and the Eden Volta flagship target the basin for year-round irrigated production.',
   'Estimate','Region 17 draft from GIPC Investor Roadmap 2nd ed and ADVCF Volta RIF v1.0', date '2026-08-29', null),
  ('volta','infrastructure-logistics',2,
   'Inland water transport on Lake Volta, the incomplete Eastern Corridor road, the Keta Port feasibility study, and the Aflao trade corridor.',
   'Estimate','Region 17 draft from GIPC Investor Roadmap 2nd ed and ADVCF Volta RIF v1.0', date '2026-08-29', null),
  ('volta','manufacturing',3,
   'Agro-processing, apparel and textiles, and light manufacturing anchored on the 1,500-acre Adaklu site. Ghana EXIM Bank committed in October 2025 to help finance an apparel park.',
   'Estimate','Region 17 draft from GIPC Investor Roadmap 2nd ed and ADVCF Volta RIF v1.0', date '2026-08-29', null),
  ('volta','tourism-hospitality',4,
   'Wli Falls, Mount Afadja, Tafi Atome, Lake Volta, Fort Prinzenstein and the Keta heritage coast. Accommodation capacity is documented as the binding constraint.',
   'Estimate','Region 17 draft from GIPC Investor Roadmap 2nd ed and ADVCF Volta RIF v1.0', date '2026-08-29', null),
  ('volta','culture-heritage',5,
   'Ewe kente weaving at Agotime-Kpetoe and Agbozume, holding WIPO Geographical Indication protection since September 2025 and UNESCO intangible heritage listing since December 2024.',
   'Estimate','Region 17 draft from WIPO and UNESCO registrations', date '2026-08-29', null),
  ('volta','energy',6,
   'Renewable generation identified in the portfolio presented at the Volta Trade and Investment Fair in December 2025.',
   'Estimate','Region 17 draft from ADVCF Volta RIF v1.0', date '2026-08-29', null);
