/**
 * Locale configuration. Exactly one locale is populated (English).
 * French arrives later as a translation project: add the code here, add the
 * dictionary file, nothing else changes.
 */
export const LOCALES = ["en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Human-readable names, in the language itself. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
};

/** BCP 47 tag for the html lang attribute. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: "en",
};

export function isLocale(value: string | undefined): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
