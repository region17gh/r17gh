import { useEffect, useImperativeHandle, useRef, type RefObject } from "react";

import {
  TURNSTILE_ACTION,
  TURNSTILE_SCRIPT_URL,
  TURNSTILE_SITE_KEY,
  TURNSTILE_STUB_TOKEN,
  type ChallengeProblem,
  type TurnstileApi,
} from "@/lib/security/turnstile";
import { useT } from "@/i18n";

/**
 * The Turnstile challenge that stands in front of a member number.
 *
 * Mounted for the whole of the join flow rather than on one screen, because a
 * number is claimed at three different moments: when the code is confirmed,
 * when a half-finished registration is picked back up, and when a lapsed
 * reservation is replaced. A widget that only existed on the code screen would
 * leave the other two without a token.
 *
 * It renders nothing a member normally sees. `interaction-only` keeps the
 * widget invisible until Cloudflare actually wants a person to do something,
 * which for almost every member is never, and matters on a metered connection.
 * When something does go wrong the screen says so in words: this component
 * reports the problem upward and `/join/register` renders it, the same way the
 * reservation recovery notice is rendered.
 */

export interface ChallengeHandle {
  /**
   * A token the server can spend, waiting for the widget to finish if it is
   * still working. Null when there is no prospect of one, which is the screen's
   * cue to stop and say so rather than to retry.
   */
  token: () => Promise<string | null>;
  /**
   * Throws away the token in hand and asks for another. Called after every
   * token that goes to the server, because Turnstile tokens are single-use, and
   * when a member asks to try again after a failure.
   */
  reset: () => void;
}

export interface ChallengeProps {
  handle: RefObject<ChallengeHandle | null>;
  /** Null clears the problem. Called whenever the widget's standing changes. */
  onProblem: (problem: ChallengeProblem | null) => void;
}

/** How long to wait on a widget that is still working before saying so. */
const TOKEN_WAIT_MS = 30_000;

/**
 * No site key in a development checkout is the one case the stub covers.
 *
 * `import.meta.env.DEV` is a build-time literal, so this whole constant folds
 * to `false` in a production build and the sentinel below becomes unreachable.
 * The server refuses the sentinel independently, in a build that does not
 * contain the branch that would accept it. Two mechanisms, neither of which is
 * an environment variable that can be set on a live deployment.
 */
const STUBBED: boolean = import.meta.env.DEV && !TURNSTILE_SITE_KEY;

let scriptPromise: Promise<TurnstileApi | null> | null = null;

/** Loads Cloudflare's script once per document. Resolves null if it will not load. */
function loadTurnstile(): Promise<TurnstileApi | null> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi | null>((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }
    const existing = window as Window & { turnstile?: TurnstileApi };
    if (existing.turnstile) {
      resolve(existing.turnstile);
      return;
    }
    const tag = document.createElement("script");
    tag.src = TURNSTILE_SCRIPT_URL;
    tag.async = true;
    tag.defer = true;
    tag.onload = () => resolve(existing.turnstile ?? null);
    tag.onerror = () => resolve(null);
    document.head.appendChild(tag);
  });
  return scriptPromise;
}

export function Challenge({ handle, onProblem }: ChallengeProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<TurnstileApi | null>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const tokenRef = useRef<string | null>(null);
  /** Callers of token() parked until the widget produces one. */
  const waitingRef = useRef<((token: string | null) => void)[]>([]);
  const onProblemRef = useRef(onProblem);
  onProblemRef.current = onProblem;

  /** Hands the same answer to everyone waiting and empties the queue. */
  const settle = (token: string | null) => {
    const waiting = waitingRef.current;
    waitingRef.current = [];
    for (const resolve of waiting) resolve(token);
  };

  useEffect(() => {
    if (STUBBED) return;

    if (!TURNSTILE_SITE_KEY) {
      // Reached only outside development: STUBBED already covers the
      // dev-with-no-key case. A production build with no site key is a
      // deployment misconfiguration, not a member failing a challenge, and
      // handing an empty sitekey to Cloudflare's widget would produce
      // whatever undocumented failure mode it has for that input -- which is
      // exactly the kind of unexplained, repeatable "try again" this
      // component exists to avoid. Caught here, deterministically, before
      // the widget is ever asked to render.
      console.error(
        "[turnstile] VITE_TURNSTILE_SITE_KEY is empty in a production build. No challenge can " +
          "run and no member number can be issued until it is set.",
      );
      onProblemRef.current("unavailable");
      settle(null);
      return;
    }

    let cancelled = false;
    void loadTurnstile().then((api) => {
      if (cancelled) return;
      const container = containerRef.current;
      if (!api || !container) {
        // Blocked, offline, or an extension took it out. Nothing will arrive,
        // so anyone waiting is told now rather than left on a spinner.
        onProblemRef.current("unavailable");
        settle(null);
        return;
      }
      apiRef.current = api;
      widgetIdRef.current = api.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        action: TURNSTILE_ACTION,
        appearance: "interaction-only",
        theme: "auto",
        size: "flexible",
        "refresh-expired": "auto",
        callback: (token: string) => {
          tokenRef.current = token;
          onProblemRef.current(null);
          settle(token);
          // Cloudflare's own confirmation ("Success!") has nothing left to tell
          // a member who was never shown a challenge, and for the rare member
          // who was, the credential they are about to receive is the
          // confirmation. A passing check announces nothing.
          container.style.setProperty("display", "none");
        },
        "error-callback": () => {
          tokenRef.current = null;
          onProblemRef.current("failed");
          settle(null);
        },
        "expired-callback": () => {
          // refresh-expired is on auto, so a replacement is already coming.
          // The screen is told only so a token asked for in this gap waits.
          tokenRef.current = null;
        },
        "timeout-callback": () => {
          tokenRef.current = null;
          onProblemRef.current("expired");
          settle(null);
        },
      });
    });

    return () => {
      cancelled = true;
      const api = apiRef.current;
      if (api && widgetIdRef.current !== undefined) api.remove(widgetIdRef.current);
      settle(null);
    };
    // Rendered once for the life of the flow, deliberately. Re-rendering the
    // widget would discard a solved challenge every time the member moved
    // between steps. `settle` is captured from the first render and only ever
    // reads waitingRef.current, so the stale closure is the correct one.
  }, []);

  useImperativeHandle(
    handle,
    (): ChallengeHandle => ({
      token: async () => {
        if (STUBBED) return TURNSTILE_STUB_TOKEN;
        if (tokenRef.current) return tokenRef.current;
        return new Promise<string | null>((resolve) => {
          let done = false;
          const finish = (token: string | null) => {
            if (done) return;
            done = true;
            resolve(token);
          };
          waitingRef.current.push(finish);
          window.setTimeout(() => {
            if (done) return;
            // Still working after half a minute. Said plainly, with the widget
            // on screen, rather than left hanging on the Continue button.
            onProblemRef.current("expired");
            finish(null);
          }, TOKEN_WAIT_MS);
        });
      },
      reset: () => {
        tokenRef.current = null;
        onProblemRef.current(null);
        // Undoes the hide from a prior success: a fresh check may yet need to
        // interact with this member, and it cannot if the widget stays hidden.
        containerRef.current?.style.removeProperty("display");
        const api = apiRef.current;
        if (api && widgetIdRef.current !== undefined) api.reset(widgetIdRef.current);
      },
    }),
    [],
  );

  if (STUBBED) {
    // Development only, and deliberately impossible to miss. The branch that
    // renders this is not in a production build, and neither is the branch on
    // the server that would honour the token it stands for.
    return (
      <p className="r17-notice" data-tone="alert" role="status">
        {t("join.challenge.stub")}
      </p>
    );
  }

  return <div ref={containerRef} style={{ marginBottom: "var(--space-4)" }} />;
}
