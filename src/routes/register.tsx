import { createFileRoute, redirect } from "@tanstack/react-router";

import { LEGACY_REDIRECTS } from "@/lib/charter/legacyPaths";

const target = LEGACY_REDIRECTS.find((entry) => entry.from === "/register")!.to;

/** Legacy `/register`, without a locale segment. */
export const Route = createFileRoute("/register")({
  beforeLoad: () => {
    throw redirect({ href: target, statusCode: 301, throw: true });
  },
});
