import { useEffect, useRef, useState } from "react";

import { readHandleAvailability, worthCheckingHandle } from "@/lib/join/handle";
import {
  fetchHandleSuggestions,
  isHandleAvailable,
  isHandleReserved,
} from "@/lib/member/membership";

/**
 * Long enough that choosing an address does not send a request per keystroke,
 * short enough that the answer is there when the member stops typing. Members
 * are frequently on metered or unreliable connections, so the request that is
 * never sent is the one that costs nothing.
 */
export const HANDLE_CHECK_DEBOUNCE_MS = 400;

/** What the check found, as far as the screen is concerned. */
export type HandleUnavailable = "taken" | "reserved";

export interface HandleAvailability {
  /** A request is in flight. Not set while the member is still typing. */
  checking: boolean;
  /** The register was asked about this address and said it is free. */
  free: boolean;
  /** Addresses that were free when the register was asked. Clickable. */
  suggestions: string[];
}

interface UseHandleAvailabilityOptions {
  handle: string;
  firstName: string;
  lastName: string;
  /** False everywhere except the screen that asks for an address. */
  enabled: boolean;
  /** Called with the reason an address cannot be had, or null when it can. */
  onResult: (problem: HandleUnavailable | null) => void;
}

/**
 * Checks an address against the register while it is being chosen.
 *
 * Collision is expected to be the highest-volume case at launch, not an edge
 * case: many members want the same first name. So this is not written as error
 * handling. It answers a question the member is already asking, and it answers
 * it here rather than at /verify, after they have completed the whole flow.
 *
 * The check at /verify stays where it is. The address is committed there, not
 * here, so someone can still take it in between. This makes that race rare
 * instead of routine; it does not remove it.
 */
export function useHandleAvailability({
  handle,
  firstName,
  lastName,
  enabled,
  onResult,
}: UseHandleAvailabilityOptions): HandleAvailability {
  const [checking, setChecking] = useState(false);
  const [free, setFree] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // Answers can come back out of order on a slow connection. Only the most
  // recently asked question is allowed to write to the screen.
  const latest = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const ticket = ++latest.current;
    const candidate = handle.trim();

    // Whatever the member just typed makes the previous answer stale. Clear it
    // now, so a "taken" from the address before this one is never left standing
    // against this one.
    onResult(null);
    setFree(false);
    setSuggestions([]);

    if (!worthCheckingHandle(candidate)) {
      // Malformed, empty or too short: answered on the device, no request sent.
      // The format message is the submit path's to show, not this one's.
      setChecking(false);
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        setChecking(true);
        const available = await isHandleAvailable(candidate);
        if (ticket !== latest.current) return;

        if (available !== false) {
          // Free, or unknowable because the check itself failed. Neither is
          // something to stop a member over. Only a definite yes is confirmed
          // to the member; a check that could not run says nothing at all.
          setFree(available === true);
          setChecking(false);
          return;
        }

        // Asked together, not one after the other: the member should see the
        // reason and the way out in the same beat.
        const [reserved, offered] = await Promise.all([
          isHandleReserved(candidate),
          fetchHandleSuggestions(firstName, lastName, candidate),
        ]);
        if (ticket !== latest.current) return;

        const outcome = readHandleAvailability(available, reserved);
        if (outcome === "taken" || outcome === "reserved") {
          onResult(outcome);
          setSuggestions(offered);
        }
        setChecking(false);
      })();
    }, HANDLE_CHECK_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [handle, firstName, lastName, enabled, onResult]);

  return { checking, free, suggestions };
}
