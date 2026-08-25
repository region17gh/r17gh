import { createFileRoute, redirect } from "@tanstack/react-router";

import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * Every member-facing page lives under a locale segment. The bare root sends
 * callers to the default locale so no page is ever served without one.
 */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/$locale", params: { locale: DEFAULT_LOCALE } });
  },
});
