/**
 * How long a one-time code is, and who decides.
 *
 * GoTrue decides, not this screen. The code length is a Supabase project
 * setting, and it has already been changed once while the input was hardcoded
 * to six characters. The input truncated what the member typed, the truncated
 * value did not verify, and the member was told "that code did not match" after
 * typing it correctly. A configuration change presented as the member's
 * mistake, which is the worst way for this to fail.
 *
 * So nothing here hardcodes a length, and two rules hold:
 *
 * 1. The input accepts the whole range Supabase can issue, 6 to 10 digits. It
 *    is never capped below `OTP_MAX_LENGTH`, so a code is never silently cut
 *    short, and a length change in the Dashboard is a no-op on this side.
 * 2. A length that cannot be a code is its own message, never a mismatch. Only
 *    the provider gets to say a code was wrong.
 *
 * `VITE_AUTH_OTP_LENGTH` may state the project's current setting. It is
 * advisory: it never narrows what the input accepts, because a stale build
 * value would recreate exactly the failure above. It exists so a setting
 * outside the range this screen can accept is visible in development rather
 * than discovered by a member.
 */

/** The shortest code Supabase will issue. */
export const OTP_MIN_LENGTH = 6;

/** The longest code Supabase will issue. */
export const OTP_MAX_LENGTH = 10;

/**
 * What the input accepts. Always the full range: see rule 1 above.
 */
export const OTP_ACCEPTED_LENGTH = { min: OTP_MIN_LENGTH, max: OTP_MAX_LENGTH } as const;

/**
 * The project's configured length, when the build was told it, and only when
 * that value is one this screen can accept. Advisory, never a gate.
 */
export function configuredOtpLength(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const length = Number(raw);
  if (!Number.isInteger(length)) return null;
  if (length < OTP_MIN_LENGTH || length > OTP_MAX_LENGTH) return null;
  return length;
}

/**
 * Whether a configured value is one this screen could not serve. A `true` here
 * is a deployment problem, not a member problem.
 */
export function otpLengthOutOfRange(raw: string | undefined): boolean {
  if (raw === undefined || raw.trim() === "") return false;
  const length = Number(raw);
  if (!Number.isInteger(length)) return true;
  return length < OTP_MIN_LENGTH || length > OTP_MAX_LENGTH;
}

/** Digits only, and never trimmed to a length. Trimming is what broke this. */
export function normaliseCode(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * `null` means the entry is plausibly a code and is worth sending to the
 * provider. Anything else is answered here, in its own words.
 */
export type CodeProblem = "empty" | "length";

export function checkCode(value: string): CodeProblem | null {
  const code = normaliseCode(value);
  if (code.length === 0) return "empty";
  if (code.length < OTP_MIN_LENGTH || code.length > OTP_MAX_LENGTH) return "length";
  return null;
}
