# Region 17 Ghana

Membership platform for Ghana's seventeenth region: the global African diaspora.

**Region 17 is a US 501(c)(3) nonprofit** and an initiative of the Embassy of Ghana to the United States. It operationalizes President Mahama's December 2025 declaration that the diaspora is Ghana's seventeenth region.

**Launch:** mid-September 2026. **Wedge:** membership register + monthly Regional Spotlight town hall.

Members are the global African diaspora, Ghanaians at home and abroad, continental Africans, and allies. **A large share are mobile-first on metered or unreliable connections.** Build for that as the primary case.

---

## 🛑 Never do these without being asked

- **Never publish or deploy.** Not to production, not to a custom domain, not on your own initiative. This has already happened once and replaced the live institutional site. Publishing is in the same category as destructive operations: it requires an explicit instruction.
- **Never run destructive database operations** — drops, truncates, bulk deletes, schema changes to existing tables — without stating the plan and waiting.
- **Never grant `INSERT` on `public.members` to `authenticated`.** Registration goes through `register_member()` only. Granting it reopens the founding-window land grab.
- **Never commit secrets.** API keys go in environment variables. If you find one committed, stop and say so.

---

## The pass gate

Work proceeds in passes. **One pass per PR.** A pass has a stated scope and a stated set of things it deliberately does not cover.

- State the plan before writing a migration, and wait.
- Migrations are reviewed as their own commit, never mixed with UI.
- Run `supabase/tests/pass1_invariants.sql` after **any** change touching member tables, policies, or triggers. Paste the output into the PR body.
- If a fix fails twice, stop and re-examine the cause. Three attempts at the same fix means the diagnosis is wrong.
- Ask when a requirement is ambiguous. Guessing on the data model or consent behaviour is expensive to undo once real members exist.

---

## Database invariants — do not relax

These are enforced in the database, not the UI. The security memory in Supabase records the same list.

| Invariant | Why |
|---|---|
| No `INSERT` grant on `members`; `register_member()` is the only path | It bypasses RLS, enforces one record per auth account, claims an unexpired unclaimed reservation atomically, and derives `credential_id`. A convenience change reopens the land grab. |
| Consents are rows, never booleans; only `revoked_at` may be set | A boolean has no history and a regulator asks for history. Act 843 applies extraterritorially. |
| `member_consents` and `affirmations` are `ON DELETE RESTRICT` | Cascade would destroy the record that exists to prove consent. |
| Erasure runs through `pseudonymize_member()`, never row deletion | Sets `status = 'erased'` (never `'revoked'` — that is expulsion), logs to `erasure_log`, never to `conduct_actions`. |
| `founding_member` is a stored boolean, frozen on update | Cutoff is 31 Dec 2026 and never moves. Reading it live would let a config edit retroactively rewrite history. |
| Released handles stay in `reserved_handles` with reason `released` | A handle may be changed once; reissuing the old one defeats the reason for allowing the change. |
| Every visibility column and every consent defaults to the most private value | Nothing is public or opted-in by default. |
| `member_gender` readable only by the member and `r17_reporting` | See the gender section below. |

**Intentional linter flags, do not "fix":** deny-all RLS on `number_reservations`, `conduct_actions`, `erasure_log` · `current_member_id()` and `register_member()` as `SECURITY DEFINER`.

`register_member()` is the most security-sensitive function in the system. Any edit needs a real read, not a quick patch.

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

A design system exists as a separate Lovable library project. **Consume it; never redefine it.**

- **No hardcoded hex. No hardcoded spacing. No font names outside the token files.** Everything references a CSS custom property. `0` and `100vh` are the only acceptable literals.
- Cascade order, later files intentionally override earlier: base → `region-colors.css` → `region-patterns.css` → `a11y-corrections.css` (**always last**, it is a measured WCAG patch layer).
- Do not edit `_ds/…/tokens/regions.css`. Superseded; exists only to keep import chains resolving.
- Token files get replaced in place as design work continues. Nothing may break when they are.

**Region colours:** `--region-<slug>` is ink (text, strokes, badges). `--region-<slug>-fill` is map areas only, never behind text. **Colour never carries meaning alone** — every region mark ships with the region name or code. Choropleths use the pattern channel. Below ~14px per region, drop the pattern and raise boundary weight.

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

It appears on the membership credential, the Compact screen, and the welcome email.

Citizenship, Right of Abode, and Ghana Card questions route to Ghana's Diaspora Affairs Office or the Ministry of the Interior. **We refer. We never advise on eligibility and never imply influence over outcomes.**

**Never use Adinkra symbols, kente patterns, or traditional Ghanaian motifs as decoration.** They carry specific meanings and belong to specific communities. Any traditional visual language requires named Ghanaian cultural review.

**Equal standing.** Members are Ghanaians abroad, Ghanaians at home, African diaspora, continental Africans, and allies — all identical. Never rank belonging. Never define a member by what they lack ("Ally: committed to the work", never "no Ghanaian heritage"). Never assume a member has been to Ghana, can name a region, or knows their ancestry. **Never ask anyone to prove descent.**

**Voice:** plain, direct, institutional. Short sentences. No em dashes or en dashes as sentence punctuation — commas, colons, parentheses, or separate sentences. Banned: unlock, empower, seamless, revolutionize, world-class, leverage, journey, elevate.

**Never promise outcomes we do not control:** jobs, visas, citizenship, investment returns, placement.

---

## Stack

React + Tailwind (Tailwind consumes the CSS custom properties, never its own palette) · Supabase (database, auth, RLS) · Resend (transactional email) · TypeScript strict, never `any`.

**Auth:** magic link only, no passwords.
**i18n:** scaffolding from day one — strings externalised, locale routing live, English the only populated locale. French later as a translation project.

---

## Data protection

Act 843 applies extraterritorially, plus every host-country regime members live in.

- **RLS on every table containing member data.** Verify by querying as an anonymous user before considering it done. Generated policies routinely look correct and permit more than intended.
- **Never collect:** immigration or residency status, documentary proof of ancestry, financial account details, income, net worth, political affiliation, biometrics.
- Never put personal data in URL parameters, query strings, or logs.
- Every stored consent needs a corresponding control in settings the member can find and change.
- Draft state persists to local storage on any multi-step flow — a refresh on a poor connection must not lose the session.

---

## Pre-launch gates

Tracked and unresolved. Do not treat the product as launch-ready while any are open.

- **Cloudflare Turnstile live on `/join` in production.** Currently stubbed. Sequential member numbers during the founding window are scriptable.
- Privacy policy, terms, and Code of Conduct live before the first signup.
- Counsel read on the age-gate implementation.
- Data Protection Commission registration determined.
