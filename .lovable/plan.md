# Test accounts without burning member numbers, plus a preview fix

## 1. Preview runtime error

The preview is failing to load `@tanstack/react-start`'s client entry (`Failed to fetch dynamically imported module`). This is a stale Vite dev-server/module-graph issue, not app code. Fix: restart the dev server (kill the supervised `vite` process so it respawns) and confirm the preview loads.

## 2. Document the test-account procedure

Add `docs/testing.md` covering what was explained in chat, so it survives the session:

- Auth accounts are free; a member number is only consumed when `register_member()` claims a live reservation. Stopping before the final registration step consumes nothing.
- Full end-to-end test registrations in the dev project do consume a number; afterwards pseudonymize/remove the test member and reset the sequence:
  `SELECT setval('public.member_number_seq', 1, false);` (dev project only, never production).
- Schema regression testing uses `supabase/tests/pass1_invariants.sql`, which self-rolls-back; reset the sequence afterwards as above.

No code or schema changes.
