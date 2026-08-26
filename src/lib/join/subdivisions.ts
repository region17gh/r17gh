/**
 * Whether to ask for the tier between country and city, and which dictionary
 * key names it — state, province, prefecture, county, region: whatever the
 * country itself calls it.
 *
 * Free text, not a dropdown: there is no ISO 3166-2 table in this schema
 * (see the migration that added `members.subdivision`), so nothing here can
 * validate against a real list of a country's subdivisions. What this *can*
 * do without that data is name the tier correctly and know when not to ask
 * at all. The label itself lives in the dictionary, under
 * `join.subdivisionLabels.<key>`, like every other string a member sees.
 */

export interface SubdivisionConfig {
  /** Key under join.subdivisionLabels. "generic" outside the countries below. */
  labelKey: string;
  /** Asked, but never enforced beyond "not blank" — free text, not a list. */
  required: boolean;
}

/** ISO 3166-1 alpha-2. Countries whose local terminology this screen knows by name. */
const LABEL_KEYS: Record<string, string> = {
  US: "us",
  CA: "ca",
  AU: "au",
  JP: "jp",
  GB: "gb",
  FR: "fr",
};

/** Countries this tier is required for: large federations where every address has one. */
const REQUIRED: ReadonlySet<string> = new Set(["US", "CA", "AU"]);

/**
 * City-states: hidden entirely rather than shown empty-and-optional. Asking
 * a member in Singapore for a province is asking a question their country
 * does not have an answer to.
 */
const CITY_STATES: ReadonlySet<string> = new Set(["SG", "MC", "VA", "HK", "MO"]);

/** Null for a city-state or an unselected country: the field does not render. */
export function subdivisionConfig(countryCode: string): SubdivisionConfig | null {
  const code = countryCode.trim().toUpperCase();
  if (!code || CITY_STATES.has(code)) return null;
  return { labelKey: LABEL_KEYS[code] ?? "generic", required: REQUIRED.has(code) };
}
