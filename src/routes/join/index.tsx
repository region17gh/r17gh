import { createFileRoute, redirect } from "@tanstack/react-router";

import { LEGACY_REDIRECTS } from "@/lib/charter/legacyPaths";

const target = LEGACY_REDIRECTS.find((entry) => entry.from === "/join")!.to;

/**
 * Legacy `/join`, from before locale-first routing. Permanent, not temporary:
 * this address is in circulated material and it is never coming back.
 */
export const Route = createFileRoute("/join/")({
  beforeLoad: () => {
    throw redirect({ href: target, statusCode: 301, throw: true });
  },
});
