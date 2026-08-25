# Region 17 — pass 1: database schema and RLS only

This pass delivers one migration. No pages, no auth wiring, no join flow. You review the SQL, then I verify the policies as an anonymous caller and report the result before anything is built on top.

## What the migration creates

**Member core**
- `members` — the register. Sequential permanent `member_number`, `credential_id` in the form `R17-26-000248-K`, `handle` (nullable, changeable once ever), names, email, month and year of birth only, country, city, connection types, region interests, join date, class year, status, chapter link. No gender column. No full date of birth.
- `number_reservations` — a number is held with an expiry when someone completes step 1, then claimed at verification. Abandoned reservations leave gaps, which is expected.

**Record of standing and consent**
- `member_consents` — one row per consent per member, with granted, revoked, policy version and mechanism. Never booleans.
- `affirmations` — append-only. Written at signup and at each annual affirmation.
- `member_standing` — founding member, contributing member, fellow, chapter leader, honours. Multiple concurrent.
- `member_contributions` — feeds contributing member standing.

**Member-authored detail**
- `member_intent` — why here, current ask, current offer, open to.
- `member_profiles` — role, organization, sector, skills, languages, bio, links. Sparse by design, nothing required.
- `member_settings` — preferences as jsonb. Preferences only; the consent record lives in `member_consents`.
- `member_visibility` — one column per profile section, each of public, members, institutions, hidden. Every column defaults to hidden.

**Scaffold, no UI**
- `chapters`, `chapter_roles`.

**Config**
- `app_config` — holds the founding-member cutoff date and the current compact, conduct and privacy policy versions. Not hardcoded anywhere.

## Rules the migration enforces in the database, not the UI

- Handle may be changed once, ever. A trigger blocks a second change.
- Affirmations and consent grants are append-only. Updates and deletes are blocked by trigger; a consent is withdrawn by setting `revoked_at`, which is the only permitted update.
- Age gate: birth year and month must place the member at 18 or older at insert.
- `founding_member` and `class_year` are derived, not free-form input.
- A member number cannot be issued twice, including under concurrent signups. Reservation uses a sequence plus a unique constraint, not a read-then-write.
- Every visibility column and every consent starts at the most private value.

## Access rules in plain language

- A signed-in member reads and writes only their own records, across every member table.
- Anonymous callers get nothing from any member table. There is no public read on the register in this pass. Directory and `/m/[handle]` reads arrive in a later pass as a narrow, visibility-aware read path, so a policy written now could not be verified against real behaviour.
- `app_config` and `chapters` are readable by anyone; only the service role writes them.
- Number reservations are not readable by members at all. They are handled by trusted server code.

## Verification before anything is built

After the migration runs I will, and will report each result explicitly:

1. Query every member table as an anonymous caller and confirm zero rows and no permission leak.
2. Insert a row as one member and attempt to read and update it as a second member, confirming denial.
3. Attempt a second handle change, an affirmation update, and an under-18 insert, confirming each is rejected.

If any check permits more than intended, the fix goes into a correcting migration before pass 2 begins.

## Deliberately not in this pass

Auth wiring, the join flow, page shells, Turnstile, Resend, chapters UI, skills exchange, messaging, matching, payments, localisation.

**Tracked for the pre-launch gate:** Cloudflare Turnstile must be live on `/join` in production. A stub that behaves correctly in preview must not survive to launch: sequential member numbers during the founding window are scriptable and permanently taken.

## Technical notes

- `members.user_id uuid` links to the Supabase auth user, nullable until verification, with no foreign key into `auth.users` per Supabase guidance.
- Enums as Postgres types: `member_status`, `consent_type`, `standing_type`, `visibility_level`, `connection_type`, `been_to_ghana`.
- `country` constrained to an ISO 3166-1 alpha-2 reference table rather than free text; `region_interests` constrained to the sixteen Ghanaian region slugs used by the design system's region tokens.
- Every public-schema table gets explicit GRANTs alongside its policies.
- `updated_at` maintained by trigger on mutable tables; append-only tables carry no `updated_at`.
- Design system: when pages arrive next pass they consume `@/design-system/region-17-ghana-design-system-e3e62f` directly, tokens only, no local hex, spacing or font declarations, so later token drops from Claude Design land without breaking anything.
