import { supabase } from "@/integrations/supabase/client";

/**
 * `region_payload(slug)` — the one call a region page makes for real data.
 *
 * Read the contract string before trusting the shape. The function emits
 * `region-payload/2` today; `page_built` on a district arrives with
 * `region-payload/3`. Both are accepted here and a district with no
 * `page_built` key reads as false, so this file works either side of that
 * migration without a second code path.
 *
 * Everything the RPC does not back is listed in `not_yet_backed` and comes
 * back empty: facts, needs, constraints, timeline, activity. The page does not
 * pretend otherwise — see `voltaMockContent.ts` for what it renders instead
 * and why that is a deliberate, temporary exception.
 */

export const SUPPORTED_CONTRACTS = ["region-payload/2", "region-payload/3"] as const;

export interface PayloadRegion {
  slug: string;
  name: string;
  capital: string | null;
  url_path: string;
  band: string | null;
  depth: string;
  ink_token: string;
  fill_token: string;
  pattern: number | null;
  data_confidence: string;
  reference_source: string | null;
  reference_verified: string | null;
}

export interface PayloadDistrict {
  slug: string;
  name: string;
  capital: string | null;
  /** Zone slug: `southern-coastal`, `capital-central`, `highland-border`. Nullable in the schema. */
  zone: string | null;
  /** Bare path, no leading slash, no `regions/` prefix: `volta/ho-municipal`. */
  url_path: string;
  summary: string | null;
  depth: string;
  data_confidence: string;
  reference_source: string | null;
  reference_verified: string | null;
  /**
   * Whether this district's own page is built and safe to navigate to.
   * Absent under `region-payload/2`; absent reads as false.
   *
   * Deliberately NOT derived from `depth` or from partnered status. A
   * partnered district can have no page yet, and a listed one can have a page
   * written for it. They are independent facts and the schema keeps them apart.
   */
  page_built?: boolean;
}

export interface PayloadZone {
  slug: string;
  district_count: number;
}

export interface PayloadSector {
  rank: number;
  sector_slug: string;
  sector_name: string;
  note: string | null;
  data_confidence: string;
  reference_source: string | null;
  reference_verified: string | null;
  declared_by: string | null;
}

export interface RegionPayload {
  contract: string;
  generated_at: string;
  region: PayloadRegion | null;
  zones: PayloadZone[];
  districts: PayloadDistrict[];
  priority_sectors: PayloadSector[];
  not_yet_backed: string[];
}

export class RegionPayloadError extends Error {}

/**
 * Everything that can go wrong reaching the RPC, as one readable line.
 *
 * The call has three failure surfaces and they are easy to confuse from the
 * outside: the Supabase client can fail to construct at all (a build with no
 * `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` throws on first use, and
 * that throw comes out of the property access on `supabase`, not out of the
 * request); the request itself can fail in the browser (offline, blocked, CORS);
 * or PostgREST can answer with an error. They land in the same catch and, until
 * this existed, reached the page as an unlabelled boolean. Naming which surface
 * failed is the whole difference between reading the cause and guessing at it.
 */
function describe(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

export async function fetchRegionPayload(slug: string): Promise<RegionPayload> {
  let data: unknown;
  let error: { message: string; code?: string } | null;

  try {
    ({ data, error } = await supabase.rpc("region_payload", { p_slug: slug }));
  } catch (err) {
    // Client construction and transport both throw rather than return `error`.
    throw new RegionPayloadError(`region_payload could not be called — ${describe(err)}`, {
      cause: err,
    });
  }

  if (error) {
    throw new RegionPayloadError(
      `region_payload failed${error.code ? ` (${error.code})` : ""}: ${error.message}`,
    );
  }

  const payload = data as RegionPayload | null;
  if (!payload || !payload.region) {
    throw new RegionPayloadError(`region_payload returned no region for "${slug}"`);
  }

  // The contract string is the thing to check, per the reconciliation doc. An
  // unrecognised one means the RPC's shape moved under us; fail loudly here
  // rather than render half a page from keys that are no longer there.
  if (!(SUPPORTED_CONTRACTS as readonly string[]).includes(payload.contract)) {
    throw new RegionPayloadError(
      `region_payload contract "${payload.contract}" is not one this page reads (${SUPPORTED_CONTRACTS.join(", ")})`,
    );
  }

  return payload;
}

/** `page_built` reads as false wherever the column or the payload key is absent. */
export function isPageBuilt(district: PayloadDistrict): boolean {
  return district.page_built === true;
}

/**
 * Confidence labels come back from the database title-cased (`Sourced`,
 * `Estimate`, `Conflicted`); `ConfidenceFlag` takes a lowercase level and
 * knows four. `Sourced` has no flag of its own and reads as verified.
 */
export function confidenceLevel(
  label: string | null | undefined,
): "verified" | "estimate" | "projected" | "disputed" {
  switch ((label ?? "").toLowerCase()) {
    case "verified":
    case "sourced":
      return "verified";
    case "projected":
      return "projected";
    case "conflicted":
    case "disputed":
      return "disputed";
    default:
      return "estimate";
  }
}
