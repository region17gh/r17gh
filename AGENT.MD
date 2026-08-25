# Region 17 Ghana

Membership platform for Ghana's seventeenth region: the global African diaspora.

**All agent instructions live in `CLAUDE.md`.** This file exists because
root-level `AGENTS.md` is read by Lovable on every session regardless of
session length, which is a stronger guarantee than other context surfaces get.
Keeping one canonical file avoids drift between tools.

@CLAUDE.md

---

## If the import above did not resolve

Read `CLAUDE.md` at the repository root before writing anything. It is the
contract for this codebase. The four invariants that matter most, restated here
so they survive even a failed import:

- **RLS on every member table.** Verify by querying as an anonymous user.
- **Consent and affirmation records are append-only.** Only `revoked_at` may
  be set on a consent. Never `UPDATE` or `DELETE` either table.
- **Registration goes through `register_member()` only.** Never grant `INSERT`
  on `public.members` to `authenticated`. Doing so reopens the founding-window
  land grab that function exists to close.
- **Right to erasure is `pseudonymize_member()`, never row deletion.** It sets
  `status = 'erased'` (never `'revoked'`, which means expulsion) and logs to
  `erasure_log`, never to `conduct_actions`.

After any change touching member tables, policies, or triggers, run
`supabase/tests/pass1_invariants.sql`. A change that fails it is wrong.

**Never publish or deploy on your own initiative.** Never run destructive
database operations without stating the plan and waiting. Publishing has
already happened once unprompted and replaced the live institutional site of an
entity operating under a presidential mandate.

Region 17 is a US 501(c)(3) nonprofit, not a government body. Membership
confers no citizenship, residence, visa, or right of entry. The disclaimer
text in `CLAUDE.md` is a safety control, not copy: reproduce it verbatim,
never reword or soften it.
