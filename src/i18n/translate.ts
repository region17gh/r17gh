import en from "./locales/en.json";
import { DEFAULT_LOCALE, type Locale } from "./config";

/**
 * The dictionary lookup, with no React in it.
 *
 * Extracted from the provider so that code with no component tree around it can
 * translate too. The welcome email is the reason: it is composed on the server,
 * from the same strings the screens use, so a copy change lands on every
 * surface at once rather than on the ones somebody remembered.
 */

type Dictionary = Record<string, unknown>;

/**
 * Dictionaries are bundled statically, one per locale. Members are frequently on
 * metered connections: a locale is a single small JSON payload, not a runtime fetch.
 */
const DICTIONARIES: Record<Locale, Dictionary> = {
  en: en as Dictionary,
};

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

function lookup(dict: Dictionary, key: string): string | undefined {
  const value = key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in (node as Dictionary)) {
      return (node as Dictionary)[part];
    }
    return undefined;
  }, dict);
  return typeof value === "string" ? value : undefined;
}

/** A translate function for one locale, falling back to the default locale. */
export function translator(locale: Locale): Translate {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  const fallback = DICTIONARIES[DEFAULT_LOCALE];

  return (key, vars) => {
    const template = lookup(dict, key) ?? lookup(fallback, key) ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}
