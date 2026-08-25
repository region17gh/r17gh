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
