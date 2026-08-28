/**
 * The member's Region 17 address: r17gh.com/m/<handle>.
 *
 * The format below is the same rule the database enforces in
 * `members_handle_format`. Checking it here is a courtesy so the member sees the
 * problem while they are typing; the constraint, the reserved list and the
 * uniqueness index remain the authority.
 */

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 30;

/** Mirrors CHECK members_handle_format. */
const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export type HandleProblem = "empty" | "tooShort" | "tooLong" | "format";

/** Suggests an address from the member's name, exactly as the prototype does. */
export function suggestHandle(firstName: string, lastName: string): string {
  const suggestion = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  // A name that yields fewer than three usable characters gets no suggestion,
  // rather than one the database would reject.
  return suggestion.length >= HANDLE_MIN_LENGTH
    ? suggestion.slice(0, HANDLE_MAX_LENGTH)
    : "";
}

/** Normalises as the member types: lowercase, and only the permitted characters. */
export function normaliseHandle(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, HANDLE_MAX_LENGTH);
}

export function checkHandle(input: string): HandleProblem | null {
  const handle = input.trim();
  if (!handle) return "empty";
  if (handle.length < HANDLE_MIN_LENGTH) return "tooShort";
  if (handle.length > HANDLE_MAX_LENGTH) return "tooLong";
  if (!HANDLE_PATTERN.test(handle)) return "format";
  return null;
}

/**
 * How many alternatives to ask the register for when an address is gone.
 *
 * Enough to feel like a choice, few enough to read on a phone without
 * scrolling. `suggest_handles()` returns at most this many, and fewer when the
 * member's name yields fewer readable options.
 */
export const HANDLE_SUGGESTIONS_WANTED = 5;

/** Whether an address is worth asking the register about. */
export function worthCheckingHandle(input: string): boolean {
  // Format is settled here, on the device, instantly and without a request.
  // Only an address that could actually be claimed justifies a round trip:
  // members are frequently on metered connections.
  return checkHandle(input.trim()) === null;
}

/**
 * What the member is told, given what the register said.
 *
 * `available` is null when the check could not run at all. That is deliberately
 * not treated as a problem: nothing on this screen blocks a join, and the
 * address is not committed here. `activate_membership()` has the final word
 * when it is committed at /verify.
 *
 * Reserved and taken are different things and are kept apart. Taken is the
 * ordinary case and says nothing about the member; reserved means the address
 * was never available to anyone.
 */
export function readHandleAvailability(
  available: boolean | null,
  reserved: boolean,
): "available" | "taken" | "reserved" | "unknown" {
  if (available === null) return "unknown";
  if (available) return "available";
  return reserved ? "reserved" : "taken";
}
