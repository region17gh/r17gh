/**
 * The Turnstile contract, shared by the widget and the server that checks it.
 *
 * Nothing secret lives here. The site key is public by design and the sentinel
 * below is a well-known string: the whole of the stub's safety is on the server
 * side, in `src/server/turnstile.server.ts`, and none of it is on the client.
 */

/** Cloudflare's widget script, in explicit-render mode so React owns the mount. */
export const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * The site key, committed to the repository.
 *
 * A Turnstile site key is public by design: it is compiled into the browser
 * bundle and served to every visitor, which is the whole of what it is for.
 * Commit 295bae4, which removed `.env` from the index, said so explicitly and
 * recorded that no rotation was needed for it.
 *
 * It is committed because the deployment is the part that keeps failing. When
 * the build receives no `VITE_TURNSTILE_SITE_KEY`, this module resolves to the
 * empty string, `Challenge` takes its "no site key in a production build"
 * branch before the widget is ever rendered, and every visitor to
 * `/join/register` is shown the unavailable notice on load -- the failure that
 * has now reached production twice, on 29 Aug and again now. PR #40 established
 * the reason with evidence while fixing the identical fault in the Supabase
 * client: the platform injects configuration into neither the build nor the
 * server runtime. A constant cannot be absent.
 *
 * Development is deliberately excluded. `import.meta.env.DEV` is a build-time
 * literal, so a production build folds this to the constant while a
 * development checkout with no configuration still resolves to the empty
 * string and still gets the stub. Rotating the site key, or moving the widget,
 * means editing this one line.
 */
const COMMITTED_TURNSTILE_SITE_KEY = "0x4AAAAAAEcbKsPMskb2iyZF";

/**
 * The public site key. Absent only in a development checkout with no Turnstile
 * configured, which is the one case the development stub exists to cover.
 */
export const TURNSTILE_SITE_KEY: string =
  (import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined)?.trim() ||
  (import.meta.env.DEV ? "" : COMMITTED_TURNSTILE_SITE_KEY);

/**
 * Bound to the widget and checked again on the server, so a token minted for
 * some other Turnstile-protected action cannot be spent on a member number.
 */
export const TURNSTILE_ACTION = "reserve-member-number";

/**
 * The stand-in a development checkout sends when no site key is configured.
 *
 * It is accepted only by a build that still contains the branch that accepts
 * it, which a production build does not. See `turnstile.server.ts`.
 */
export const TURNSTILE_STUB_TOKEN = "stub.local-development-only";

/** Why the join screen has no usable token. Each one gets its own sentence. */
export type ChallengeProblem =
  /** The script did not load: an extension, a blocked domain, a dead network. */
  | "unavailable"
  /** The widget ran and refused, or the token was rejected on the server. */
  | "failed"
  /** The token aged out before it was spent. */
  | "expired";

/** A single Turnstile widget, as the explicit-render API exposes it. */
export interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      "timeout-callback"?: () => void;
      "refresh-expired"?: "auto" | "manual" | "never";
      appearance?: "always" | "execute" | "interaction-only";
      theme?: "auto" | "light" | "dark";
      size?: "normal" | "flexible" | "compact";
    },
  ) => string | undefined;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}
