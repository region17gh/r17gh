-- member_intent holds one free-text ask and one free-text offer per member. It
-- predates declarations and is superseded by them: a declaration is scoped to a
-- place, bounded by a window, carries a pathway and a sector, and is the only
-- thing the matching engine can see.
--
-- The table stays. Registration wrote into it, the rows are a member's own
-- words, and dropping it would break fetchIntent(). What stops is rendering it
-- beside declarations, because two surfaces disagreeing about what a member
-- said is worse than one surface being thin. Same treatment as chapter_roles:
-- commented, not dropped.
comment on table public.member_intent is
  'SUPERSEDED by public.declarations. One free-text ask and offer per member, invisible to matching. Retained for the historical record and for anything registration still writes; no member-facing surface should render it alongside declarations. A member''s current ask and offer are their most recent declaration in each direction.';

comment on column public.member_intent.current_ask is
  'Superseded by a declaration with direction = seek.';
comment on column public.member_intent.current_offer is
  'Superseded by a declaration with direction = offer.';
