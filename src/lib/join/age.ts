/**
 * The age gate, in one place.
 *
 * The database trigger `enforce_member_rules` is the backstop and rejects an
 * under-18 record outright. This runs first, client-side, so a minor is turned
 * away before any email address is captured or any network call is made.
 *
 * The rule matches the trigger exactly: month and year only, and the last day
 * of the birth month is treated as the birth date. That is the conservative
 * reading, so nobody is admitted whom the database would then refuse.
 */

export const MINIMUM_AGE = 18;

export type AgeVerdict = "missing" | "under" | "ok";

/** Last day of the given month, i.e. the latest date the member could have been born. */
function endOfBirthMonth(year: number, month: number): Date {
  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(year, month, 0));
}

export function checkAge(
  birthMonth: number | null,
  birthYear: number | null,
  now: Date = new Date(),
): AgeVerdict {
  if (!birthMonth || !birthYear) return "missing";

  const latestBirthDate = endOfBirthMonth(birthYear, birthMonth);
  const eighteenthBirthday = new Date(
    Date.UTC(
      latestBirthDate.getUTCFullYear() + MINIMUM_AGE,
      latestBirthDate.getUTCMonth(),
      latestBirthDate.getUTCDate(),
    ),
  );
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return eighteenthBirthday <= today ? "ok" : "under";
}

/** Selectable birth years, newest first. Mirrors the prototype's range. */
export function birthYears(now: Date = new Date()): number[] {
  const newest = now.getUTCFullYear() - 15;
  const years: number[] = [];
  for (let year = newest; year >= 1925; year--) years.push(year);
  return years;
}

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
