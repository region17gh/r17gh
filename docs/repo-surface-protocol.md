# Region 17 — Repo Surface Protocol

**Purpose:** chat has no GitHub access and will not get it. This document
assigns repo work to Claude Code and defines the handback format so chat can
reason about repo state without reading it.

**Repo:** `region17gh/r17ghana` (public, personal account, not an org)
**Supabase:** `idmxottsjqeiatgiudvt`

---

## 1. Who owns what

**Claude Code owns the repo.** Reading files, diffs, migrations,
`supabase/tests/pass1_invariants.sql`, workflow runs, PR certification, writing
migrations, opening PRs. It has direct filesystem access to a cloned `main`,
which is strictly better than any connector: `certify-pr-merge` is defined as
reading fresh file content on a freshly pulled `main`, and only Claude Code can
actually do that.

**Chat owns decisions and institutional state.** The Notion ledger (Decisions,
Open Items, Documents, Sessions, Regions), live Supabase state via the
connector, schema architecture calls, copy, strategy, and anything where the
answer is a position rather than a file. Chat has verified read on production
Postgres, so it can check what is deployed without touching the repo.

**Claude Design owns design deliverables.** Tokens, components, the credential,
launch surfaces. Runs parallel to schema work, not after it.

The line that matters: chat can tell you what production is. Claude Code can
tell you what the repo says. Drift between those two is the failure mode
`.github/workflows/check-migrations.yml` exists for, and diagnosing it needs
both surfaces.

---

## 2. Standing prompt for Claude Code

Paste at the top of any repo session.

```
Repo: region17gh/r17ghana. Read CLAUDE.md at the repo root before anything else.
It is the contract for this codebase. AGENTS.md imports it.

Before you answer anything about repo state, pull main and re-derive HEAD live.
Report the SHA you actually read at. Never answer from a cached read, a PR title,
a merge notification, or a green check.

Non-negotiable, restated because they are expensive to undo:
- RLS on every table containing member data. Verify by querying as anonymous.
- Never grant INSERT on public.members to authenticated. register_member() only.
- Consents are rows, never booleans. Only revoked_at may be set.
- Erasure is pseudonymize_member(), never row deletion.
- Never publish or deploy. Never run destructive database operations without
  stating the plan and waiting.

One pass per PR. State the plan before writing a migration, and wait. Migrations
are their own commit, never mixed with UI. After any change touching member
tables, policies, or triggers, run supabase/tests/pass1_invariants.sql and paste
the output into the PR body.

Test harness role rule, learned by exposing three live vulnerabilities: fixtures
run as service_role, assertions run as authenticated, and anything the harness
asserts about runs in the role it asserts about. A harness running elevated
proves nothing.

If a fix fails twice, stop and re-examine the cause. Three attempts at the same
fix means the diagnosis is wrong.
```

---

## 3. `certify-pr-merge`

Recreate as a Claude Code prompt.

```
Certify PR #<N> on region17gh/r17ghana.

Method:
1. Pull main fresh. Re-derive HEAD live. State the SHA.
2. Read the actual file content of every file the PR claims to touch. Not the
   diff view, not the PR description, the file as it now exists on main.
3. For each change specified in the original ask, report one of: matched,
   divergent, missing. Quote the line you matched against.
4. Report scope creep: anything present in the diff that was not specified.
   Judge each as benign, correct, or a problem.
5. State whether the PR title over- or undersells the diff. A title that reads as
   an additive convenience over a migration that changes live function behaviour
   or permanently caps a production sequence is undersold and must be called out.
6. Confirm whether the migration is applied to production, or state plainly that
   you cannot. Merged is not applied.
7. Close with a Position: certified, certified with findings, or not certified.

Then produce the handback block in section 4 so it can be pasted into chat.
```

---

## 4. Handback format

What Claude Code returns to chat. Chat cannot verify any of this independently,
so the handback must carry enough that chat is not asked to trust a summary.

```
REPO HANDBACK
Repo: region17gh/r17ghana
HEAD read at: <full SHA>
Read at (UTC): <timestamp>

Files read (full path, not glob):
- <path> (<line count>)

Findings, one line each, each with the file and line it rests on:
- <finding> [<path>:<line>]

Migrations on disk not in the applied list, or vice versa:
- <version> <filename> <in repo / applied / both>

Position: <certified | certified with findings | not certified | N/A>
Unverifiable from this surface: <list>
```

Chat then cross-checks the migration list against production with
`list_migrations` on `idmxottsjqeiatgiudvt` and reports drift in either
direction. That cross-check is the whole reason the two surfaces are split, and
it is the one thing neither surface can do alone.

---

## 5. When chat needs a repo fact and Claude Code is not open

Upload the file. For certifying a migration the entire surface is the migration
file plus `supabase/tests/pass1_invariants.sql`. Nothing else is required. Do
not paste a summary of a file and ask chat to reason about it: paste the file.

---

## 6. Where this document lives

Committed at `docs/repo-surface-protocol.md` and referenced from `CLAUDE.md`, so
the division survives a new chat, a new account, and a new contributor. Logged
to the Notion Documents database as a DOC-### entry, querying the live ledger
max immediately before the write.
