import { isPageBuilt, type PayloadDistrict } from "./payload";
import { VOLTA_DISTRICT_MARKS, type DistrictMark } from "./voltaDistrictMarks";
import { MOCK_DEPTH } from "./voltaMockContent";

/**
 * One district, as the explorer renders it: the real row from
 * `region_payload('volta')` joined to the two things the database has no column
 * for (a marker coordinate and an editorial line), and to the design's
 * placeholder depth chip.
 *
 * The join key is `places.slug`, both sides. A district whose slug has no entry
 * in `VOLTA_DISTRICT_MARKS` still renders in the list and in the boundaries; it
 * just has no pin on the map. That is the honest failure for a nineteenth
 * district appearing in the database before anyone places its marker, and it is
 * better than dropping the row.
 */

export interface DistrictView {
  /** `places.slug`. The only identifier this page uses for a district. */
  slug: string;
  name: string;
  capital: string;
  /** Zone slug from `places.zone`, or null. */
  zone: string | null;
  /** Bare path from `places.url_path`: `volta/ho-municipal`. */
  urlPath: string;
  summary: string | null;
  dataConfidence: string;
  referenceSource: string | null;
  referenceVerified: string | null;
  /** From `places.page_built`. Never inferred from depth or partnered status. */
  pageBuilt: boolean;
  /** Real publication depth, from `places.depth_slug`. */
  depth: string;
  /** Design placeholder depth chip. Mock; see `voltaMockContent.ts`. */
  displayDepth: "Listed" | "Profiled" | "Partnered";
  mark: DistrictMark | null;
}

export function toDistrictViews(districts: PayloadDistrict[]): DistrictView[] {
  return districts.map((d) => ({
    slug: d.slug,
    name: d.name,
    capital: d.capital ?? "",
    zone: d.zone,
    urlPath: d.url_path,
    summary: d.summary,
    dataConfidence: d.data_confidence,
    referenceSource: d.reference_source,
    referenceVerified: d.reference_verified,
    pageBuilt: isPageBuilt(d),
    depth: d.depth,
    displayDepth: MOCK_DEPTH[d.slug] ?? "Listed",
    mark: VOLTA_DISTRICT_MARKS[d.slug] ?? null,
  }));
}

/**
 * Districts grouped for the list, in the order the zones read down the region.
 *
 * A district with a null `places.zone` lands in a trailing "not yet zoned"
 * group rather than vanishing. `region_payload`'s `zones[]` only counts
 * districts that have one, so a list built from that array alone silently drops
 * them; `north-dayi` and `south-tongu` were both in that state as recently as
 * the reconciliation doc's snapshot.
 */
export const ZONE_ORDER = ["southern-coastal", "capital-central", "highland-border"] as const;

export interface ZoneGroup {
  zone: string | null;
  districts: DistrictView[];
}

export function groupByZone(districts: DistrictView[]): ZoneGroup[] {
  const seen = new Set<string>();
  const groups: ZoneGroup[] = [];

  for (const zone of ZONE_ORDER) {
    const rows = districts.filter((d) => d.zone === zone);
    if (rows.length) {
      groups.push({ zone, districts: rows });
      seen.add(zone);
    }
  }
  // Any zone the database has that this file does not know about, in slug order.
  const others = [...new Set(districts.map((d) => d.zone))]
    .filter((z): z is string => z !== null && !seen.has(z))
    .sort();
  for (const zone of others) {
    groups.push({ zone, districts: districts.filter((d) => d.zone === zone) });
  }
  const unzoned = districts.filter((d) => d.zone === null);
  if (unzoned.length) groups.push({ zone: null, districts: unzoned });

  return groups;
}

/** `southern-coastal` reads as "Southern coastal" when no dictionary key exists. */
export function zoneLabelFallback(zone: string): string {
  const words = zone.split("-").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
