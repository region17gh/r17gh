import { getRequest } from "@tanstack/react-start/server";

import {
  TURNSTILE_ACTION,
  TURNSTILE_STUB_TOKEN,
  type ChallengeProblem,
} from "@/lib/security/turnstile";

/**
 * The Turnstile check, on the server, and the only thing standing between a
 * script and the founding-window sequence.
 *
 * `.server.ts`, and imported only from inside a server handler, so no part of
 * this file reaches a client bundle. The secret is read from the environment
 * and is never returned, logged, or put in an error message.
 *
 * Read `verifyChallenge` together with `issueReservation` in
 * `src/server/membership.ts`: the two live in the same function on purpose, so
 * that a failed challenge cannot cost a member number.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare gives siteverify a few seconds; a hung call must not hang a join. */
const SITEVERIFY_TIMEOUT_MS = 10_000;

/**
 * Whether the local-development stub may be honoured. Two conditions, and the
 * first is settled at build time.
 *
 * `import.meta.env.DEV` is replaced by the literal `false` when Vite builds for
 * production, so `false && ...` folds to `false` and every branch below that
 * tests this constant is dead code the bundler drops. The stub is not disabled
 * in a production build; it is absent from one. That is the difference the
 * pre-launch gate asks for: a flag can be set by mistake, a branch that was
 * never compiled cannot be reached by any environment variable at all.
 *
 * The second condition is a deliberate opt-in a developer sets by hand, so the
 * stub does not turn itself on merely because someone ran `vite dev`.
 */
const STUB_ALLOWED: boolean =
  import.meta.env.DEV && process.env["TURNSTILE_ALLOW_STUB"] === "true";

// The same flag set against a production build. It cannot switch the stub on,
// because the branch it would switch on was never compiled; saying so is the
// only useful thing left to do with it. Deliberately not thrown: a stray
// environment variable must not be able to take the join screen down either.
if (import.meta.env.PROD && process.env["TURNSTILE_ALLOW_STUB"] === "true") {
  console.error(
    "[turnstile] TURNSTILE_ALLOW_STUB is set on a production build. It has no effect: the " +
      "stub branch is not present in this build. Remove the variable.",
  );
}

/** A verdict. `ok` is the only value that may be followed by a reservation. */
export type ChallengeVerdict =
  | { ok: true }
  | { ok: false; problem: ChallengeProblem };

/** Cloudflare's siteverify response, narrowed to the fields this checks. */
interface SiteverifyResponse {
  success?: boolean;
  action?: string;
  "error-codes"?: string[];
}

/**
 * Checks a token with Cloudflare and says whether a number may now be issued.
 *
 * Every path that is not an explicit success returns `ok: false`. There is no
 * branch here that lets a missing secret, a network failure, or an unparseable
 * response through: a challenge that cannot be checked has not been passed.
 */
export async function verifyChallenge(token: string | null | undefined): Promise<ChallengeVerdict> {
  const supplied = typeof token === "string" ? token.trim() : "";
  if (!supplied) return { ok: false, problem: "unavailable" };

  if (STUB_ALLOWED && supplied === TURNSTILE_STUB_TOKEN) {
    console.warn(
      "[turnstile] Development stub accepted. TURNSTILE_ALLOW_STUB is set and this is a " +
        "development build. This branch does not exist in a production build.",
    );
    return { ok: true };
  }

  // The sentinel is only ever a sentinel. Outside a stub-enabled development
  // build it is refused as the string it is, never passed to Cloudflare.
  if (supplied === TURNSTILE_STUB_TOKEN) {
    console.error("[turnstile] Stub token presented to a build that does not honour it. Refused.");
    return { ok: false, problem: "failed" };
  }

  const secret = process.env["TURNSTILE_SECRET_KEY"]?.trim();
  if (!secret) {
    // Fail closed, loudly. A missing secret is a deployment fault, and the
    // correct response to it is to stop issuing numbers, not to stop checking.
    console.error(
      "[turnstile] TURNSTILE_SECRET_KEY is not set. Refusing to issue member numbers.",
    );
    return { ok: false, problem: "unavailable" };
  }

  const body = new URLSearchParams({ secret, response: supplied });

  // Cloudflare fronts this app, so the connecting address is already known to
  // them; passing it back sharpens their signal. Absent off the edge, in which
  // case the field is simply left out. It goes to Cloudflare and nowhere else,
  // and is never written to a log or a URL of ours.
  const remoteIp = clientIp();
  if (remoteIp) body.set("remoteip", remoteIp);

  let payload: SiteverifyResponse;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[turnstile] siteverify returned HTTP ${response.status}.`);
      return { ok: false, problem: "unavailable" };
    }
    payload = (await response.json()) as SiteverifyResponse;
  } catch {
    console.error("[turnstile] siteverify could not be reached.");
    return { ok: false, problem: "unavailable" };
  }

  if (payload.success !== true) {
    const codes = payload["error-codes"] ?? [];
    // Cloudflare's own codes, which name no person and carry nothing personal.
    console.warn(`[turnstile] Challenge refused: ${codes.join(", ") || "no reason given"}.`);
    const expired =
      codes.includes("timeout-or-duplicate") || codes.includes("invalid-input-response");
    return { ok: false, problem: expired ? "expired" : "failed" };
  }

  // The widget binds this action and Cloudflare echoes it back. A token minted
  // against some other Turnstile-protected action is not spendable here.
  if (payload.action !== undefined && payload.action !== TURNSTILE_ACTION) {
    console.warn(`[turnstile] Token carried action "${payload.action}"; refused.`);
    return { ok: false, problem: "failed" };
  }

  return { ok: true };
}

/** The connecting address as Cloudflare reports it, or null off the edge. */
function clientIp(): string | null {
  try {
    const headers = getRequest()?.headers;
    return headers?.get("cf-connecting-ip") ?? null;
  } catch {
    return null;
  }
}
