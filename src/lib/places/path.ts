import type { Locale } from "@/i18n";

/**
 * Where a place lives in the URL.
 *
 * DECIDED 2026-09-01, against the route tree rather than against the design
 * export's assumption. Three facts settle it:
 *
 * 1. Every member-facing route in this app is locale-first, mounted under
 *    `src/routes/$locale/`. The design export links to `/regions/volta/ho`,
 *    which carries no locale segment and could not mount here at all.
 * 2. `places.url_path` is stored as a bare path with no leading slash and no
 *    prefix: `volta` for the region, `volta/ho-municipal` for a district. It
 *    is the place's address inside the place tree, not a URL.
 *    `docs/volta-district-id-reconciliation.md` says so explicitly and warns
 *    against concatenating it onto a guessed prefix and calling that verified.
 * 3. The district identifier in that path is `places.slug`, never the design
 *    export's short id. `ho`, `keta` and `agotime` are retired.
 *
 * So a place URL is `/{locale}/regions/{url_path}`, and it is built here and
 * nowhere else. When the district route lands, this file is the only place
 * that has to agree with it.
 */

/** `/en/regions/volta` — the region page. This route exists. */
export function regionPath(locale: Locale, regionSlug: string): string {
  return `/${locale}/regions/${regionSlug}`;
}

/**
 * `/en/regions/volta/ho-municipal` — a district page.
 *
 * NO ROUTE SERVES THIS YET. It is the address a district page will answer at,
 * and the region page only navigates to it for a district whose `page_built`
 * is true. `page_built` is false for all eighteen Volta districts, so nothing
 * currently follows this href; the spotlight sheet shows its not-yet-built
 * state instead. Flipping `page_built` before the district route exists
 * produces a 404, which is why the column's comment in the database says so
 * too.
 *
 * Takes `places.url_path` whole rather than a region and a slug, so the path
 * inside the tree stays the database's to decide.
 */
export function placePath(locale: Locale, urlPath: string): string {
  return `/${locale}/regions/${urlPath}`;
}
