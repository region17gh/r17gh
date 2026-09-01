/**
 * The parts of a Volta district that only the design export holds.
 *
 * `public.places` has no `lat`, `lon`, marker-anchor or editorial-line column,
 * so these four fields have nowhere else to come from. Everything that IS in
 * the database — name, capital, zone, summary, url_path, depth, confidence —
 * comes from `region_payload('volta')` and is not repeated here.
 *
 * KEYED BY `places.slug`, per `docs/volta-district-id-reconciliation.md`. The
 * design export's short ids (`ho`, `keta`, `agotime`, `afadzato`) are retired,
 * not wrapped: there is no translation table anywhere and there must not be
 * one. `public/geo/volta-districts.geojson` is keyed the same way, so a
 * feature-state call and a marker and a list row all address a district by the
 * same string.
 *
 * The mapping was verified two ways before these coordinates were re-keyed:
 * by name and capital against `region_payload('volta')`, and by checking that
 * every marker below falls inside the polygon now carrying its slug.
 *
 * Note on one spelling: the design export and the boundary source both say
 * "Afadzato South"; `public.places` says "Afadjato South". The database wins
 * for anything a member reads, which is why no name appears in this file.
 */

export interface DistrictMark {
  lon: number;
  lat: number;
  /** Which side of the marker its label hangs on, in the fallback SVG map. */
  anchor: "start" | "end";
  /** Editorial line, written for the region page. Not a sourced fact. */
  line: string;
  /** Opens the spotlight sheet on the video tab rather than the photo tab. */
  mediaType?: "video";
}

export const VOLTA_DISTRICT_MARKS: Record<string, DistrictMark> = {
  anloga: {
    lon: 0.9,
    lat: 5.82,
    anchor: "start",
    line: "The seat of Hogbetsotso and the shallot fields between the sea and the Keta lagoon.",
  },
  "keta-municipal": {
    lon: 0.99,
    lat: 5.92,
    anchor: "start",
    line: "Fort Prinzenstein and a coastline under active erosion; the sea defence ends here.",
    mediaType: "video",
  },
  "ketu-south-municipal": {
    lon: 1.13,
    lat: 6.1,
    anchor: "end",
    line: "The Aflao crossing, West Africa's busiest land border on the Ghana side.",
  },
  "ketu-north-municipal": {
    lon: 0.98,
    lat: 6.23,
    anchor: "start",
    line: "Border-belt farming and weekly markets feeding Denu and Aflao.",
  },
  "south-tongu": {
    lon: 0.6,
    lat: 6.01,
    anchor: "end",
    line: "The lower Volta at Sogakope; river tourism and rice on the floodplain.",
  },
  "central-tongu": {
    lon: 0.51,
    lat: 6.11,
    anchor: "end",
    line: "Floodplain farming between the river and the Ho road.",
  },
  "ho-municipal": {
    lon: 0.47,
    lat: 6.6,
    anchor: "start",
    line: "The regional capital: the RCC, the teaching hospital, and the region's referral point for imaging.",
  },
  "ho-west": {
    lon: 0.32,
    lat: 6.53,
    anchor: "end",
    line: "Farming districts on the Ho to Kpeve road, under Adaklu's inselberg.",
  },
  adaklu: {
    lon: 0.55,
    lat: 6.44,
    anchor: "start",
    line: "The mountain that names the district; a surveyed but unbuilt visitor site.",
  },
  "agotime-ziope": {
    lon: 0.73,
    lat: 6.55,
    anchor: "start",
    line: "Kpetoe, where agbadza kente has been woven for two hundred years.",
    mediaType: "video",
  },
  "akatsi-south": {
    lon: 0.8,
    lat: 6.13,
    anchor: "start",
    line: "The junction town on the Accra to Aflao road.",
  },
  "akatsi-north": {
    lon: 0.74,
    lat: 6.26,
    anchor: "start",
    line: "Smallholder cassava and maize north of the trunk road.",
  },
  "north-tongu": {
    lon: 0.4,
    lat: 6.09,
    anchor: "end",
    line: "Battor hospital and the ferry towns on the lower Volta.",
  },
  "south-dayi": {
    lon: 0.32,
    lat: 6.68,
    anchor: "end",
    line: "Kpeve landing on the lake and the climb toward the highlands. The ferry crossing links South Dayi to the Ho road, and ties trade between the lake towns and the district capital.",
  },
  "north-dayi": {
    lon: 0.28,
    lat: 6.85,
    anchor: "end",
    line: "Lakeside farming below the Anfoega ridge.",
  },
  "hohoe-municipal": {
    lon: 0.47,
    lat: 7.15,
    anchor: "end",
    line: "The highland hub: Wli Falls is twenty minutes east.",
  },
  "afadjato-south": {
    lon: 0.43,
    lat: 7.03,
    anchor: "end",
    line: "Mount Afadja, Ghana's highest peak, and the Tafi monkey sanctuary.",
  },
  "kpando-municipal": {
    lon: 0.29,
    lat: 6.99,
    anchor: "end",
    line: "The lake crossing at Kpando Torkor; pottery and fish landing sites.",
  },
};

/** Points of interest on the map. Keyed by name, unrelated to district ids. */
export const VOLTA_POIS = [
  { name: "Wli Falls", lat: 7.115, lng: 0.588 },
  { name: "Mount Afadja", lat: 6.995, lng: 0.585, side: "left" as const },
  { name: "Fort Prinzenstein", lat: 5.919, lng: 0.989 },
  { name: "Aflao crossing", lat: 6.119, lng: 1.19, side: "left" as const },
  { name: "Kpetoe looms", lat: 6.552, lng: 0.679 },
];
