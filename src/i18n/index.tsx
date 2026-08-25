import { createContext, useContext, useMemo, type ReactNode } from "react";

import { type Locale } from "./config";
import { translator, type Translate } from "./translate";

export * from "./config";
export { translator, type Translate } from "./translate";

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
  // One implementation, shared with the server. See i18n/translate.ts.
  const value = useMemo<I18nValue>(() => ({ locale, t: translator(locale) }), [locale]);

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
