# Region 17 Ghana

Membership platform for Ghana's seventeenth region: the global African diaspora.

**Region 17 is an independent US 501(c)(3) nonprofit.** It is not an initiative of the Embassy of Ghana, nor of any administration. Government, embassy and institutional relationships are partnerships Region 17 seeks on its own terms, and they never constrain how it operates or what it builds. It responds to President Mahama's December 2025 declaration that the diaspora is Ghana's seventeenth region; responding to a declaration is not being an arm of the body that made it.

Region 17 runs programs, events, resources, services and partnerships to create the conditions in which the African diaspora can mobilize. The **Diaspora Mobilization Platform (DMP)** is one product within that: the system of record that answers what is needed, where, who can do it, and how to get it done.

**Launch:** the date moves to launch correctly rather than on schedule. Do not treat any date in this file or in a decision log as fixed without confirming it. **Wedge:** membership register + monthly Regional Spotlight town hall.

Members are the global African diaspora, Ghanaians at home and abroad, continental Africans, and allies. **A large share are mobile-first on metered or unreliable connections.** Build for that as the primary case.

---

## 🛑 Never do these without being asked

- **Never publish or deploy.** Not to production, not to a custom domain, not on your own initiative. This has already happened once and replaced the live institutional site. Publishing is in the same category as destructive operations: it requires an explicit instruction.
- **Never run destructive database operations** — drops, truncates, bulk deletes, schema changes to existing tables — without stating the plan and waiting.
- **Never grant `INSERT` on `public.members` to `authenticated`.** Registration goes through `register_member()` only. Granting it reopens the founding-window land grab.
- **Never commit secrets.** API keys go in environment variables or Supabase Vault. If you find one committed, stop and say so.

---

## Before you build — check what exists

Written after four collisions in one week: a second join flow, a Next.js app proposed beside the live TanStack Start one, a third sign-in page, and a duplicate `activate_membership()` function that left PostgREST with two overloads doing unrelated things. Every one had the same cause — designing from a mental model rather than from the code that runs.

**Four checks before proposing, scaffolding or designing any surface, route, flow, table or function. Say what you found.**

1. **The route tree.** `find src/routes -type f | sort`. Know the framework, the routing convention and the locale segment before writing a component.
2. **The live schema.** List functions and tables before adding either. A name collision in Postgres is silent: two overloads, two behaviours, one RPC name.
3. **The live product.** If a URL exists for it, look at the URL. `/en/join/register` existed for weeks before it was rebuilt from scratch.
4. **The generated types.** `src/integrations/supabase/types.ts` is the app's view of the database. If it disagrees with the live schema, regenerate before building against either.

**Extend what is there.** Replacing something requires saying so explicitly, with the reason, before starting. Never introduce a second framework, a second client, a second auth path, or a second implementation of an existing flow.

**Known overlaps, all deliberate, none to be "cleaned up":**

| Pair | Which is which |
|---|---|
| `activate_membership(p_handle)` / `activate_with_declaration(...)` | The first is registration: handle choice and email confirmation. The second is platform activation: a first declaration and matching consent. Different jobs, deliberately different names. |
| `member_intent` / `declarations` | `member_intent` holds one current ask and one current offer per member. `declarations` holds many, scoped to a place, bounded by a window, and drives matching. Both exist. Decide which a profile surface reads from before building one. |
| `chapter_roles` / `roles` | `chapter_roles` is superseded by the unified `roles` table. Commented and revoked, not dropped. |
| `resend.server.ts` / the notifier edge function | Two send paths, one Resend account. See the email section. |

---

## The pass gate

Work proceeds in passes. **One pass per PR.** A pass has a stated scope and a stated set of things it deliberately does not cover.

- State the plan before writing a migration, and wait.
- Migrations are reviewed as their own commit, never mixed with UI.
- `supabase/tests/pass1_invariants.sql` runs in CI. `.github/workflows/pass1-invariants.yml` runs it against the PR's preview branch on every pull request and against **production** on every push to `main`, and posts the output as a single PR comment that it updates in place. You no longer paste the output into the PR body; the comment is the record. Production is the run that matters — `service_role` holds `auth.users` on preview and locally and does **not** hold it on production, so a preview-only suite reproduces the exact blind spot described below.
  - CI parses the output; it never gates on psql's exit code. The harness ends in a deliberate `RAISE EXCEPTION` to force its rollback, so a completely clean run exits non-zero. The build fails on any `FAIL` or `SKIP` line, on empty output, on a run that never reached that closing `RAISE`, and on a PASS count other than the pinned baseline. Never "fix" that with `|| true`.
  - Supabase builds a preview branch only for a pull request that changes something under `supabase/`. A PR that changes no SQL therefore has no preview branch and no schema delta, and the check reports an explicit **not run** — green because there was nothing to verify, and it says so in the comment rather than implying a pass. A PR that *does* touch `supabase/` and still has no preview branch **fails**: that is branching being broken with a schema change riding through unverified. Nothing can turn a schema change into a skip.
  - A pull request from a **fork** cannot run the harness: forks correctly get no secrets. That case reports a loud failure (`harness not run, fork PR`), never a pass. A maintainer re-runs it from a branch in this repository before merging.
  - **Still run it by hand before pushing.** CI is the backstop, not the first look, and a contributor without CI access needs it. Paste the whole file into the SQL editor, or:
    ```
    psql "$SUPABASE_DB_URL" -X -w -v ON_ERROR_STOP=1 --single-transaction -f supabase/tests/pass1_invariants.sql
    ```
    Connect as `postgres`, not `service_role`: section 11b drops to the connecting role with `RESET ROLE` for its `auth.users` fixtures, and `service_role` has no access to `auth.users` on production. `--single-transaction` keeps the `CREATE FUNCTION` and the `SELECT` that calls it on one session, which `pg_temp` requires through a pooler.
- If a fix fails twice, stop and re-examine the cause. Three attempts at the same fix means the diagnosis is wrong.
- Ask when a requirement is ambiguous. Guessing on the data model or consent behaviour is expensive to undo once real members exist.

---

## Repo surface protocol

Claude Code owns the repo: files, diffs, migrations, workflow runs, PR certification. Chat owns decisions and institutional state, and holds verified read on production Postgres through the Supabase connection.

Chat can read public files at `raw.githubusercontent.com` and should, under the four checks above. It has no write access, cannot open or merge a PR, cannot see private files, workflow runs or CI output, and will not get them. **A read of a raw file is not a read of repo state** — it has no branch, no HEAD, no knowledge of what is merged versus applied.

Drift between what the repo says and what production has is the failure mode `.github/workflows/check-migrations.yml` exists for, and diagnosing it needs both surfaces.

**`docs/repo-surface-protocol.md`** is the contract for that split. It carries the standing prompt for a repo session, the `certify-pr-merge` method, and the handback block Claude Code returns so chat can cross-check migrations against production without reading the repo. Read it before answering any question about repo state, and produce the handback block rather than a summary.

Two rules from it that bind every repo session:

- **Pull `main` and re-derive HEAD live before answering anything about repo state, and report the SHA you read at.** Never answer from a cached read, a PR title, a merge notification, or a green check.
- **Merged is not applied.** A migration on `main` is not a migration in production. State plainly when you cannot confirm which.

---

## Database invariants — do not relax

These are enforced in the database, not the UI. The security memory in Supabase records the same list.

| Invariant | Why |
|---|---|
| No `INSERT` grant on `members`; `register_member()` is the only path | It bypasses RLS, enforces one record per auth account, claims an unexpired unclaimed reservation atomically, and derives `credential_id`. A convenience change reopens the land grab. |
| Consents are rows, never booleans; only `revoked_at` may be set | A boolean has no history and a regulator asks for history. Act 843 applies extraterritorially. |
| `member_consents` and `affirmations` are `ON DELETE RESTRICT` | Cascade would destroy the record that exists to prove consent. |
| Erasure runs through `pseudonymize_member()`, never row deletion | Sets `status = 'erased'` (never `'revoked'` — that is expulsion), logs to `erasure_log`, never to `conduct_actions`. |
| `founding_member` is a stored boolean, frozen on update | The Charter window closes `2027-01-31T23:59:59Z` (D-062) and never moves. The date lives in `app_config.founding_member_cutoff`; no surface may hardcode it. Reading it live at display time is right, but *storing* the boolean is what stops a config edit retroactively rewriting who was a Charter Member. |
| Released handles stay in `reserved_handles` with reason `released` | A handle may be changed once; reissuing the old one defeats the reason for allowing the change. |
| Every visibility column and every consent defaults to the most private value | Nothing is public or opted-in by default. |
| `member_gender` readable only by the member and `r17_reporting` | See the gender section below. |
| Erasure is two steps, not one | `pseudonymize_member()` returns the `auth.users` id that still holds the member's email, and records it in `erasure_log`. The erasure is incomplete until that auth user is deleted and `mark_auth_user_deleted()` is called. `public.incomplete_erasures` must always be empty; a row there is an unfulfilled deletion right. |
| Handle matching is two-tier | Exact match on the normalized form (punctuation stripped, lookalikes folded, repeats collapsed) is a hard block. Containment of a reserved token is ALLOWED and written to `handle_reviews` for human review. Blocking on containment is the Scunthorpe problem and falls hardest on African names. |
| `reserved_handles` never contains personal or family names | Mahama, Akufo, Kufuor, Rawlings, Mills, Atta, Nana, Nii, Naa, Osei and Togbe are ordinary Ghanaian names. Reserving them tells verified members they may not use their own name. Individual impersonation is handled by identity verification and the Code of Conduct, not the reserved list. Adding a surname is a reversal. |
| The register is permanent; the directory is live | Dormancy after six months sets `status = 'dormant'`, which hides a member from the directory, search and active counts. It never deletes, never voids a member number, never touches Founding Member. There is no inactivity-based deletion. |
| A member exits only by their own request or Code of Conduct enforcement | There is no third route. Not data hygiene, not a migration that wants a clean dataset, not an integration that cannot handle nulls. |
| The credential check character is Damm, alphabet `ACDEFHJKMN`, frozen | Catches every single-character error and every adjacent transposition. Letters omit B, G, I, L, O, S, Z, each confusable with a digit. Changing either invalidates every credential ever issued, and credentials are never reissued. |

**Intentional linter flags, do not "fix":** deny-all RLS on `number_reservations`, `conduct_actions`, `erasure_log` · `current_member_id()` and `register_member()` as `SECURITY DEFINER`.

`register_member()` is the most security-sensitive function in the system. Any edit needs a real read, not a quick patch.

---

## The Diaspora Mobilization Platform

The register is who a member is. The DMP is what they can do, where, and what happened. Its invariants are enforced in the database on the same terms as the register's.

**Places.** 16 regions and 261 districts, sourced from IMCCoD. Two hierarchies: administrative (single parent, enforced by partial unique index) and traditional (multi-parent, and a traditional area cannot publish without `cultural_review_at`). `publication_depths` runs listed → profiled → partnered; partnered means an assembly named a representative who can post for themselves.

**Provenance is structural.** Every place-level fact carries `data_confidence` from `data_confidence_levels`, and `Conflicted` cannot be published — a check constraint, not a convention. A surface that cannot show the source does not show the fact. Volta's population and land area are `Conflicted` today and correctly absent from the region page.

**Declarations** are the atomic unit: one member's offer or ask, scoped to a place, bounded by a mandatory availability window that lapses to `dormant` rather than deleting. Four fields drive matching — direction, pathway, place, sector. Anything the composer or a profile collects that does not resolve to those four is invisible to the engine.

**Needs are bidirectional.** `direction` is `seek` or `offer`, so a region can post what it needs *and* what it offers: land, placements, exchanges, hosting, festivals. Without both the platform is extractive by construction.

**Engagements have no declined state.** The three exits from review are matched, redirected, or held, enforced by `engagement_transitions`. A redirect must carry a target or a written reason; a hold must carry a date. `review_due_at` is a promise the operations console reports against.

**Matching is explainable.** `matches.reasons` is a plain-language array. A member who cannot see why they were matched will not trust the next one. Never render a score.

**The activity ledger is append-only**, written by triggers, and update and delete raise at trigger level — which holds against `service_role` too. Region pages, the member feed and impact reporting all read from it.

**Aggregate reporting suppresses small cells.** `place_impact()` returns null below a floor of five for anything person-derived. Watching and declaring are counted separately and never summed: reporting that 400 people engaged with a region when 380 bookmarked it is the easiest lie in this product.

**Perks carry the business model.** Membership is free to join and free to keep, permanently. `offerings` holds programs, events, resources and services; `offering_perks` holds what membership is worth on each — free, discounted, priority, or members-only. Non-members pay the list price. Institutions pay for access, delivery and intelligence.

**Media carries credit and licence.** `media_assets` requires alt text and a credit, and `is_cleared` is false until someone confirms Region 17 may use it. Uncleared media cannot attach to a published offering. A page that cites its facts and steals its photographs is not credible.

---

## Testing and migration discipline

**A skipped test is a failed test.** Seven activation assertions silently skipped on production for two days because the harness elevated itself to `service_role` to build an `auth.users` fixture, and `service_role` has no access to `auth.users` on production. It does locally and on preview, which is why nobody saw it. The suite reported clean while the only door out of `pending_verification` was asserted about by nothing.

- Fixtures run at the lowest privilege that can build them. Use `RESET ROLE` to drop to the connecting role. **Never elevate to a privilege the target environment does not grant.** Elevation that exists only in the test is a test of the test.
- Production baseline: **83 PASS / 0 FAIL / 0 SKIP / 1 INFO**. A drop means look. CI enforces the PASS count as `EXPECTED_PASS` in `.github/workflows/pass1-invariants.yml`; a change that adds or removes a case must update that number and this line in the same commit.
- **Lowering `EXPECTED_PASS` is a security change, not housekeeping.** The count fails safe in one direction only. Remove a case and the count drops, the build goes red, and someone looks — that is the control working. But lower the constant in the same commit and the build goes green with less coverage than it had before, in a one-line diff that reads like tidying. A change that *decreases* `EXPECTED_PASS` must state in the PR body which case went and why, and is reviewed as a policy change, the same as relaxing an invariant in the table above. Raising it needs no ceremony.

**Overriding `current_member_id()` in a test is not an RLS test.** It proves the function's callers behave, not that a policy holds against a real token. At least one path must be exercised with a genuine authenticated JWT before launch.

**Writing harness cases:**
- Use `has_table_privilege()`, `has_function_privilege()`, `has_column_privilege()` for any claim about a role other than the active one. The `information_schema.*_privileges` views silently return zero rows when you ask about another role, and zero rows reads as PASS. That is a false-green generator inside a security suite.
- Assert the outcome, never the absence of an error. A zero-row UPDATE does not raise.
- Append before the final `RAISE EXCEPTION`. Fixtures elevated, assertions as `authenticated`.

**Never grant `TRUNCATE` to `anon` or `authenticated`.** TRUNCATE is not filtered by row level security. Postgres checks the privilege and empties the table. The Supabase default grants it on every new table; revoke it. RLS being correct is not protection here.

**A migration applied to production must be written to `supabase/migrations/` in the same change.** Nine were applied through the MCP connection on 27 Aug and never landed in the repo, and `check-migrations.yml` compares repo to production in one direction only, so drift introduced at the production end is invisible to it. The repo is the source of truth (D-043) or it is not.

**`SECURITY DEFINER` functions need explicit grants.** Postgres grants `EXECUTE` to `PUBLIC` by default, so a definer function that bypasses RLS is callable by every signed-in member until revoked. Every new definer function revokes from `public, anon, authenticated` and grants only to the roles that need it.

---

## The gender field — six binding conditions

Decided deliberately, against a recommendation to decouple it. Context: Ghana's Parliament passed the Human Sexual Rights and Family Values Bill on 29 May 2026 (up to 3 years for identifying as LGBTQ+, 3–5 years for funding/sponsoring/promoting, duty to report). It awaits presidential assent.

1. Never rendered on any surface visible to another member.
2. Never searchable or filterable by any user, including admins, outside `report_gender_distribution()`.
3. Never included in any export — DAOOP, partners, employers, or non-aggregated research.
4. Read restricted to the member themselves and the `r17_reporting` role.
5. Small-cell suppression in every report.
6. Genuinely optional; `prefer_not_to_say` is the default so declining is indistinguishable from not yet answering.

**Any relaxation of these is a reversal of a locked decision, not an implementation detail.** Raise it, do not do it.

---

## Design tokens

A design system exists as a separate Lovable library project, consumed at `@/design-system/region-17-ghana-design-system-e3e62f`. **Consume it; never redefine it.** A prototype that invents its own colours, spacing or components is a sketch of an idea, never a source for a route.

- **No hardcoded hex. No hardcoded spacing. No font names outside the token files.** Everything references a CSS custom property. `0` and `100vh` are the only acceptable literals.
- Cascade order, later files intentionally override earlier: base → `region-colors.css` → `region-patterns.css` → `a11y-corrections.css` (**always last**, it is a measured WCAG patch layer).
- Do not edit `_ds/…/tokens/regions.css`. Superseded; exists only to keep import chains resolving.
- Token files get replaced in place as design work continues. Nothing may break when they are.

**Region colours:** `--region-<slug>` is ink (text, strokes, badges). `--region-<slug>-fill` is map areas only, never behind text. **Colour never carries meaning alone** — every region mark ships with the region name or code. Choropleths use the pattern channel. Below ~14px per region, drop the pattern and raise boundary weight. The database holds each region's `ink_token`, `fill_token`, `pattern` and `band` in `ghana_regions`; the product reads them and never chooses a colour per component.

---

## Accessibility

WCAG 2.2 AA is the floor.

- Any control a member taps is **48px minimum**. 40px is pointer-only dense UI. 32px never carries a primary action.
- Focus indicators need 3:1. Visible focus on everything interactive.
- `prefers-reduced-motion` respected throughout.
- Focus moves to the new heading on step or route change and announces to screen readers.
- Browser back navigates within multi-step flows rather than exiting them.
- `--ink-300` and `--ink-400` are borders and decoration only, never text at any size.
- Pages usable before webfonts load. `<link rel="preconnect">` + `<link rel="stylesheet">`, never a render-blocking CSS `@import`.

---

## Copy rules

**Never imply government status.** Region 17 is not a government body. Nothing may suggest membership confers legal, immigration, or citizenship standing.

**This sentence is a safety control, not copy. Do not reword, soften, or shorten it:**

> Region 17 membership is a standing in a community. It is not a government document and confers no citizenship, residence, visa, or right of entry.

It appears on the membership credential, the Compact screen, and the welcome email. All three are live. The welcome email carries it in both the HTML and the plain-text part, and a test asserts the exact sentence in both.

Citizenship, Right of Abode, and Ghana Card questions route to Ghana's Diaspora Affairs Office or the Ministry of the Interior. **We refer. We never advise on eligibility and never imply influence over outcomes.**

**Never use Adinkra symbols, kente patterns, or traditional Ghanaian motifs as decoration.** They carry specific meanings and belong to specific communities. Any traditional visual language requires named Ghanaian cultural review.

**Equal standing.** Members are Ghanaians abroad, Ghanaians at home, African diaspora, continental Africans, and allies — all identical. Never rank belonging. Never define a member by what they lack ("Ally: committed to the work", never "no Ghanaian heritage"). Never assume a member has been to Ghana, can name a region, or knows their ancestry. **Never ask anyone to prove descent.**

**Never invent social proof.** Ratings, attendance, download and member counts are derived from real rows by trigger. There is no field anywhere for typing one in. A card with no attendees renders nothing rather than a zero.

**Voice:** plain, direct, institutional. Short sentences. No em dashes or en dashes as sentence punctuation — commas, colons, parentheses, or separate sentences. Banned: unlock, empower, seamless, revolutionize, world-class, leverage, journey, elevate.

**Never promise outcomes we do not control:** jobs, visas, citizenship, investment returns, placement.

---

## Stack

TanStack Start on Vite, deployed to Cloudflare as the worker `tanstack-start-app` · React + Tailwind (Tailwind consumes the CSS custom properties, never its own palette) · Supabase (database, auth, RLS, Edge Functions) · Resend (transactional email) · TypeScript strict, never `any`.

**This is not a Next.js project and will not become one.** New member-facing routes are TanStack Router files under `src/routes/$locale/`. Scaffolding a second framework alongside this one has been proposed once and rejected.

**Email: one Resend account, two send paths, and they are not interchangeable.**

Auth mail (the one-time code) goes through Supabase custom SMTP: GoTrue composes it and Supabase settings configure it.

Application mail goes through the Resend API from `src/server/resend.server.ts` — today the welcome email, which `src/server/welcome.ts` claims atomically before sending and releases on failure.

Queued mail goes through the `notifier` Edge Function, which drains `notification_deliveries` on a five-minute `pg_cron` schedule and carries the things a transactional send does not need: per-kind cadence, digests, quiet hours in the member's timezone, exponential backoff, and one-click unsubscribe under RFC 8058.

**What must never be duplicated across those paths: the suppression list, the API key, and the from-address.** All three are single-sourced in Supabase Vault, read by the notifier through `get_notifier_config()` and by `resend.server.ts` through the same function. Rotation is one `set_notifier_secret()` call. Every send path checks `is_suppressed()` before calling the transport — a suppression list that covers half the outbound mail is not a suppression list.

Email cannot read the design tokens, so `src/lib/email/welcome.ts` holds the one sanctioned copy of the palette values, named after the tokens they copy. It is a copy to be reconciled, never a place to invent a colour.

**Auth:** one-time code, no passwords. `shouldCreateUser` is false on sign-in: signing in must never quietly mint an auth account with no member record behind it.

**The code length is a Supabase setting, not a UI decision.** Nothing in the join screen or in the email templates may state a length, and no input may cap at six. The field accepts the full 6 to 10 digits Supabase can issue, and a length that cannot be a code is its own message. Only the provider gets to say a code was wrong. A hardcoded six against a project set to eight has already reached a member as "that code did not match" after they typed it correctly.

**Routing (D-067):** locale-first, and the story and the form are separate funnel stages with separate, separately measurable URLs.

| Path | What it is |
|---|---|
| `/<locale>/join` | The Charter story. Marketing surface, the WhatsApp forward target. |
| `/<locale>/join/register` | The registration flow. Canonical, and the only path that issues a number. |
| `/<locale>/signin` | Returning members. Sends the code. |
| `/<locale>/verify` | Handle choice and activation. |

Every CTA on the story goes to `/<locale>/join/register`. Legacy `/join`, `/register` and `/join/en` answer 301 from route files under `src/routes/`; `src/lib/charter/legacyPaths.ts` is the table and carries the reasoning, including why `/en` is deliberately *not* redirected (it is the locale root and the landing address for dead auth links, whose reason arrives in the URL fragment and would be lost on a redirect). Future locales mount as `/fr/`, `/pt/` with no route changes.

**i18n:** scaffolding from day one — strings externalised, locale routing live, English the only populated locale. French later as a translation project. **Every string a member reads is a `t()` key.** A route with hardcoded English is not finished.

---

## Data protection

Act 843 applies extraterritorially, plus every host-country regime members live in.

- **RLS on every table containing member data.** Verify by querying as an anonymous user before considering it done. Generated policies routinely look correct and permit more than intended.
- **Never collect:** immigration or residency status, documentary proof of ancestry, financial account details, income, net worth, political affiliation, biometrics.
- Never put personal data in URL parameters, query strings, or logs.
- Every stored consent needs a corresponding control in settings the member can find and change.
- Draft state persists to local storage on any multi-step flow — a refresh on a poor connection must not lose the session.
- **Matching is its own consent purpose.** A member consenting to be matched is consenting to be reached; it is recorded as `matching` in `member_consents` with a policy version, not inferred from having declared.
- Data residency: the project runs in `us-west-2`. Members in Ghana and the EU are a cross-border transfer question that needs documenting, not re-architecting.

**Registration with Ghana's Data Protection Commission is decided and in progress.** Act 843 reaches processing of data about people in Ghana regardless of where the controller sits, and UK and EU law applies based on where members are, not where we are incorporated. Being a US 501(c)(3) settles the tax question, not this one.

---

## Pre-launch gates

Tracked and unresolved. Do not treat the product as launch-ready while any are open.

- **Cloudflare Turnstile keys set in production.** The control is built and wired: `verifyChallenge()` runs inside `issueReservation()`, above the `reserve_member_number()` call and in the same function, so a failed challenge costs no reservation. What is outstanding is operational, not code. Set `VITE_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in the production environment: without the secret the server refuses to issue member numbers at all, which is the correct failure but is not a launch state. The development stub is guarded by `import.meta.env.DEV` and cannot be switched on in a production build, because the branch is not compiled into one.
- Privacy policy, terms, and Code of Conduct live before the first signup.
- **The minor-discovery procedure live in the Code of Conduct, with a named owner.** The policy is settled: self-declared birth month and year is adequate, 18+ holds across member jurisdictions, and the procedure is suspend on sight, delete within thirty days, never contact a parent, log only member number and three dates. What is not done is writing it where the person on duty can find it. A procedure that exists only in a decision log is not a procedure.
- **Confirm signup email exercised with a real send.** Only Magic Link has been seen live. Which template fires is decided by GoTrue, not by the screen, and the address used for testing already had an auth account, so `confirmation` has never actually gone out. Test from an address with no auth account, which is what every real first-time member is, and read the code out of that email.
- **At least one RLS path exercised with a real authenticated JWT.** Every check so far overrode `current_member_id()`, which tests the callers rather than the policies.
- **Cleared media exists.** `media_assets` currently holds nothing cleared, and the launch photography is unlicensed. No offering can publish while carrying uncleared media, by constraint.
- **Volta's blocking facts resolved or accepted as withheld.** Population and land area are `Conflicted` and cannot publish. The region page names them as withheld with the reason, which is honest and is not the same as resolved.
