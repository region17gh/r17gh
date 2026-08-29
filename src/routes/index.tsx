import { createFileRoute, redirect } from "@tanstack/react-router";

import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * Until the marketing home page exists, the root address is the join story.
 * Temporary (307), not permanent: the home page is planned, and a 301 would
 * sit in browser caches long after it ships.
 */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: "/$locale/join",
      params: { locale: DEFAULT_LOCALE },
      statusCode: 307,
    });
  },
});
