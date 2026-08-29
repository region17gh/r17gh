import type { Region } from "@/design-system/region-17-ghana-design-system-e3e62f/design-system/region17/data/regions";
import { REGIONS_ALPHABETICAL } from "@/lib/regions";

/**
 * The three-letter region codes, part of the locked region coding system.
 *
 * They live here rather than in the design system's data file because that file
 * is replaced in place as design work continues, and a code added there would
 * not survive the next replacement. Keyed by slug so a reordering upstream
 * cannot silently reassign one.
 *
 * Codes are unique and stable. Changing one changes what a member has seen
 * printed next to their region's name, so treat an edit as a canon change.
 */
const REGION_CODES: Record<string, string> = {
  ahafo: "AHA",
  ashanti: "ASH",
  bono: "BON",
  "bono-east": "BOE",
  central: "CEN",
  eastern: "EAS",
  "greater-accra": "GAC",
  "north-east": "NEA",
  northern: "NOR",
  oti: "OTI",
  savannah: "SAV",
  "upper-east": "UEA",
  "upper-west": "UWE",
  volta: "VOL",
  western: "WES",
  "western-north": "WNO",
};

export interface CharterRegion extends Region {
  /** Three-letter code shown beside the name in the ledger and the fact card. */
  code: string;
  /** Dictionary key for this region's 25 to 50 word fact. */
  factKey: string;
  /** Public region page. Absolute, because these pages are not in this app. */
  href: string;
  /** The region's ink, for type, codes and strokes. Never a wash behind text. */
  ink: string;
}

/**
 * Ghana's sixteen regions as the charter page needs them: alphabetical, coded,
 * and carrying the URL of their own public page.
 *
 * A region mark never travels without its name or code, so colour is never the
 * only thing carrying the identity.
 */
export const CHARTER_REGIONS: readonly CharterRegion[] = REGIONS_ALPHABETICAL.map((region) => ({
  ...region,
  code: REGION_CODES[region.slug] ?? region.slug.slice(0, 3).toUpperCase(),
  factKey: `charter.regions.${region.slug}`,
  href: `https://r17gh.com/${region.slug}`,
  ink: `var(${region.token})`,
}));

/** Every code is present and distinct. Guards a slug rename upstream. */
export function codesAreComplete(): boolean {
  const codes = CHARTER_REGIONS.map((region) => region.code);
  return (
    CHARTER_REGIONS.every((region) => region.slug in REGION_CODES) &&
    new Set(codes).size === codes.length
  );
}
