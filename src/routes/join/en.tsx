import { createFileRoute, redirect } from "@tanstack/react-router";

import { LEGACY_REDIRECTS } from "@/lib/charter/legacyPaths";

const target = LEGACY_REDIRECTS.find((entry) => entry.from === "/join/en")!.to;

/**
 * Legacy `/join/en`, the locale-suffix form. This is the address printed on
 * launch material, so it is the one that most needs to keep resolving.
 */
export const Route = createFileRoute("/join/en")({
  beforeLoad: () => {
    throw redirect({ href: target, statusCode: 301, throw: true });
  },
});
