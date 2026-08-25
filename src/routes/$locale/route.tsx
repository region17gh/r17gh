import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";

import { I18nProvider, isLocale } from "@/i18n";

/**
 * Locale segment for every member-facing page: /en/..., later /fr/...
 * An unknown segment is a 404 rather than a silent fallback, so a mistyped
 * locale never renders English at a French URL.
 */
export const Route = createFileRoute("/$locale")({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale)) throw notFound();
    return { locale: params.locale };
  },
  component: LocaleLayout,
});

function LocaleLayout() {
  const { locale } = Route.useParams();
  if (!isLocale(locale)) return null;

  return (
    <I18nProvider locale={locale}>
      {/* Nested locale routes render here. */}
      <Outlet />
    </I18nProvider>
  );
}
