/**
 * The failure Supabase hands back in the URL when an email link will not open.
 *
 * A dead confirmation link does not land on an error page. It lands on the site
 * URL carrying a fragment:
 *
 *   /en#error=access_denied&error_code=otp_expired&error_description=...
 *
 * Nothing reads that fragment by default, so the member sees an ordinary page
 * and no explanation. These helpers turn it into something a screen can answer.
 *
 * `error_description` is never rendered. It is provider wording, it arrives in
 * a URL anyone can write, and the recovery copy is ours. Only the code is read,
 * and only into a fixed set of outcomes.
 */

export type LinkProblem = "expired" | "denied" | "unknown";

export interface LinkError {
  problem: LinkProblem;
  /** The raw code, for the recovery copy to key off. Never displayed. */
  code: string;
}

function classify(error: string, code: string): LinkProblem {
  if (code === "otp_expired") return "expired";
  if (error === "access_denied") return "denied";
  return "unknown";
}

/**
 * Reads the fragment, and the query string with it: the implicit flow puts the
 * failure after the hash, the PKCE flow puts it in the query.
 */
export function readLinkError(hash: string, search = ""): LinkError | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const query = new URLSearchParams(search.replace(/^\?/, ""));
  const error = params.get("error") ?? query.get("error");
  if (!error) return null;
  const code = params.get("error_code") ?? query.get("error_code") ?? "";
  return { problem: classify(error, code), code };
}

/** Reads it off the current location, if there is one. */
export function currentLinkError(): LinkError | null {
  if (typeof window === "undefined") return null;
  return readLinkError(window.location.hash, window.location.search);
}

/**
 * Takes the failure back out of the address bar once a screen has it in hand.
 *
 * A member who shares or bookmarks the page should not be carrying a provider
 * error string around with them, and a reload should not re-announce a failure
 * they have already been shown a way out of.
 */
export function clearLinkError(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.hash = "";
  for (const key of ["error", "error_code", "error_description"]) {
    url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}
