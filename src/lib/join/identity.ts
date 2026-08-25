import { checkAge } from "./age";
import { clearDraft } from "./draft";

/**
 * The first screen's submit, with the age gate in front of everything else.
 *
 * The screen asks who someone is before it asks anything else, so all four
 * answers, including the email address, exist in the form at once. That makes
 * the order of checks here the whole protection: the gate runs first, and a
 * refusal returns before the address has been written anywhere or sent
 * anywhere. Typing an address is not capturing one.
 *
 * Kept out of the component so the order is testable without a browser.
 */

export interface IdentityAnswers {
  birthMonth: number | null;
  birthYear: number | null;
  email: string;
}

export interface IdentityHandlers {
  /** Writes the address into the draft. Never called unless the gate passed. */
  keepEmail: (email: string) => void;
  /** Requests the one-time code. Never called unless the gate passed. */
  sendCode: (email: string) => Promise<{ error: { message: string } | null }>;
  now?: Date;
}

export type IdentitySubmission =
  | { status: "dob_missing" }
  | { status: "underage" }
  | { status: "email_missing" }
  | { status: "send_failed" }
  | { status: "sent" };

/**
 * Deliberately permissive: an address is proven by the code that arrives at it,
 * not by a pattern. This only catches an empty or obviously unsendable entry so
 * the member is not left waiting for an email that was never going anywhere.
 */
export function looksSendable(email: string): boolean {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  return at > 0 && at < trimmed.length - 1 && !/\s/.test(trimmed);
}

export async function submitIdentity(
  answers: IdentityAnswers,
  handlers: IdentityHandlers,
): Promise<IdentitySubmission> {
  const verdict = checkAge(answers.birthMonth, answers.birthYear, handlers.now);

  if (verdict === "missing") return { status: "dob_missing" };

  if (verdict === "under") {
    // Nothing typed on this screen survives a refusal, the address least of all.
    // Both statements below are the point of this branch: no keepEmail, no
    // sendCode, and whatever an earlier screen had already stored goes now.
    clearDraft();
    return { status: "underage" };
  }

  const email = answers.email.trim();
  if (!looksSendable(email)) return { status: "email_missing" };

  handlers.keepEmail(email);
  const { error } = await handlers.sendCode(email);
  return error ? { status: "send_failed" } : { status: "sent" };
}
