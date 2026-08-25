import { createContext, useContext, useMemo, type ReactNode } from "react";

import en from "./locales/en.json";
import { DEFAULT_LOCALE, type Locale } from "./config";

export * from "./config";

type Dictionary = Record<string, unknown>;

/**
 * Dictionaries are bundled statically, one per locale. Members are frequently on
 * metered connections: a locale is a single small JSON payload, not a runtime fetch.
 */
const DICTIONARIES: Record<Locale, Dictionary> = {
  en: en as Dictionary,
};

function lookup(dict: Dictionary, key: string): string | undefined {
  const value = key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in (node as Dictionary)) {
      return (node as Dictionary)[part];
    }
    return undefined;
  }, dict);
  return typeof value === "string" ? value : undefined;
}

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

interface I18nValue {
  locale: Locale;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(() => {
    const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
    const fallback = DICTIONARIES[DEFAULT_LOCALE];

    const t: Translate = (key, vars) => {
      const template = lookup(dict, key) ?? lookup(fallback, key) ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      );
    };

    return { locale, t };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside <I18nProvider>. Locale routes provide it.");
  }
  return value;
}

/** Convenience: const t = useT(); t("join.title") */
export function useT(): Translate {
  return useI18n().t;
}

/** Build a locale-prefixed path: localePath("en", "/join") -> "/en/join" */
export function localePath(locale: Locale, path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${suffix === "/" ? "" : suffix}`;
}
