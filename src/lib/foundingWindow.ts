/**
 * The Charter window, read from the database and never from a constant here.
 *
 * `app_config.founding_member_cutoff` is the only statement of when Charter
 * Membership closes. A marketing page that hardcodes the date is a page that
 * keeps saying January after the board has moved it, so this module never
 * carries a fallback date: no value means no date is shown.
 *
 * `app_config` is SELECT-able by `anon`, so a signed-out reader on the story
 * page gets the same date a member sees on their credential.
 */

/**
 * The date locale each content locale is written in.
 *
 * The house copy is British English, and the cutoff is written as
 * "31 January 2027" wherever it appears. Intl's bare "en" renders the American
 * order, "January 31, 2027", so the region is named rather than left to the
 * runtime. This mirrors `DATE_LOCALE` in `lib/email/welcome.ts`.
 */
const DATE_LOCALE: Record<string, string> = { en: "en-GB" };

/** The window's close, formatted for display. UTC, because the config is UTC. */
export function formatCutoff(cutoff: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(cutoff);
  } catch {
    return cutoff.toISOString().slice(0, 10);
  }
}

/** The machine-readable form, for a <time dateTime> attribute. */
export function cutoffDateTime(cutoff: Date): string {
  return cutoff.toISOString();
}
