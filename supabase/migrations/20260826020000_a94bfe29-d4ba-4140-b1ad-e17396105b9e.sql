-- ============================================================
-- Region 17 Ghana — subdivision joins the member-editable columns
-- ============================================================
-- 20260826010000 gave register_member() a p_subdivision argument and the
-- members table its own subdivision column, but never touched the
-- column-level UPDATE grant from 20260825190000. That grant is what lets a
-- signed-in member edit their own row; everything left out of it is
-- unwritable from the browser. subdivision was left out by omission, not by
-- decision -- it belongs in the same self-describing-address group as
-- country and city, and until this migration a member could set it once at
-- signup and never change it again while country and city stayed editable.
--
-- Confirmed against production before writing this: subdivision carries
-- only SELECT and REFERENCES for authenticated, no UPDATE, while country
-- and city carry all three.
-- ============================================================

GRANT UPDATE (subdivision) ON public.members TO authenticated;
