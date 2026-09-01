# District id reconciliation — Volta map/list component

## The problem

The Volta region page (Claude Design export: `Region_Page_-_Volta_v3_dc-4.html`,
`volta-map.js`) identifies districts with short, hand-picked ids — `ho`,
`agotime`, `hohoe`, `ketu-south`, and so on. These ids live in three places
inside the design export and must agree with each other there:

1. The `districts()` array in the HTML (id, name, capital, zone, status, lat/lon, line)
2. `volta-districts.geojson` (each feature's `id` property, via `promoteId: "id"`)
3. `volta-map.js` itself, wherever it matches `props.selectedId` / `props.hoverId` / `props.dimIds` against feature or marker ids

**Some of these ids match `public.places.slug` and some do not, and that is
worse than none of them matching.** Of the eleven short ids confirmed against
the design export so far, five are already identical to the real slug
(`adaklu`, `anloga`, `central-tongu`, `ho-west`, `south-tongu`) and six are
not (`ho`, `keta`, `ketu-north`, `ketu-south`, `agotime`, `hohoe`). A total
mismatch fails loudly on the first join. A partial one fails on five rows out
of eighteen, on whichever districts happen to be wrong, and looks like a
content bug rather than a keying bug.

Slugs are the join key for `region_payload()`, `surface_offerings()`,
`place_activity()`, place routing, and place lookups everywhere else in the
schema, so the id the component holds has to be the slug — not a value that
coincides with it for some districts.

This was a deliberate, acceptable shortcut for the design phase. It is not
acceptable in the built route. Wire the component against short ids and every
join to real data silently returns nothing for the districts where the two
diverge.

## What "done" means

The component the app renders must use `places.slug` as its only district
identifier — in the district list, in the map's GeoJSON feature ids, and in
every prop (`selectedId`, `hoverId`, `dimIds`) passed through `VoltaMap`.
There is no id translation layer at runtime; the short ids are retired, not
wrapped.

## Steps

**1. Get the real slugs and names from `region_payload('volta')`, not from a
bespoke query.** The RPC already returns exactly the eighteen Volta districts
under `districts[]`, each with `slug`, `name`, `capital`, `zone`, `summary`,
`url_path`, `depth`, `data_confidence`, `reference_source` and
`reference_verified`, plus a `zones[]` array carrying the per-zone district
counts the list grouping has to agree with. It emits `"contract":
"region-payload/2"`; treat that string as the thing to check before trusting
the shape. Querying `public.places` joined to `place_links` reproduces the
same rows one layer lower and skips the contract, so prefer the RPC. This is
the source of truth for both the id and the display name — not the design
export, not this document.

**2. Match each design-export district to its real slug by `capital` and
`name`, not by pattern-guessing the slug from the short id.** Short ids are
inconsistent with the app's slugging in both directions: `ho` → `ho-municipal`
and `agotime` → `agotime-ziope` gain a suffix, while `adaklu` and `ho-west`
gain nothing. There is no rule to apply. At least one name also differs in
spelling between the two sources: the design export uses "Afadzato South,"
the database uses "Afadjato South" / `afadjato-south`. The database spelling
wins.

The verified list, read from `region_payload('volta')` on the production
project (`idmxottsjqeiatgiudvt`) on 2026-09-01:

| slug | name | capital | zone | url_path |
| --- | --- | --- | --- | --- |
| `adaklu` | Adaklu | Adaklu Waya | capital-central | `volta/adaklu` |
| `afadjato-south` | Afadjato South | Ve-Golokwati | highland-border | `volta/afadjato-south` |
| `agotime-ziope` | Agotime-Ziope | Agotime Kpetoe | capital-central | `volta/agotime-ziope` |
| `akatsi-north` | Akatsi North | Ave Dakpa | southern-coastal | `volta/akatsi-north` |
| `akatsi-south` | Akatsi South | Akatsi | southern-coastal | `volta/akatsi-south` |
| `anloga` | Anloga | Anloga | southern-coastal | `volta/anloga` |
| `central-tongu` | Central Tongu | Adidome | capital-central | `volta/central-tongu` |
| `ho-municipal` | Ho Municipal | Ho | capital-central | `volta/ho-municipal` |
| `ho-west` | Ho West | Dzolokpuita | capital-central | `volta/ho-west` |
| `hohoe-municipal` | Hohoe Municipal | Hohoe | highland-border | `volta/hohoe-municipal` |
| `keta-municipal` | Keta Municipal | Keta | southern-coastal | `volta/keta-municipal` |
| `ketu-north-municipal` | Ketu North Municipal | Dzodze | southern-coastal | `volta/ketu-north-municipal` |
| `ketu-south-municipal` | Ketu South Municipal | Denu | southern-coastal | `volta/ketu-south-municipal` |
| `kpando-municipal` | Kpando Municipal | Kpando | highland-border | `volta/kpando-municipal` |
| `north-dayi` | North Dayi | Anfoega | *(null)* | `volta/north-dayi` |
| `north-tongu` | North Tongu | Battor | capital-central | `volta/north-tongu` |
| `south-dayi` | South Dayi | Kpeve | capital-central | `volta/south-dayi` |
| `south-tongu` | South Tongu | Sogakope | *(null)* | `volta/south-tongu` |

This table is reference for the re-key, and it is a snapshot: re-read the RPC
before you use it and reconcile any row that has moved. Do not write it into
application code as a lookup table. Once step 3 and step 4 are done there is
nothing left to look up.

Six of the eighteen are not covered by an already-confirmed design-export id.
Match those by capital and name against whatever the export actually holds;
do not assume the export's id for `kpando-municipal` is `kpando`.

**3. Re-key `volta-districts.geojson`.** Replace every feature's `id`
property (the one `promoteId: "id"` reads) with the real slug. Verify with
`promoteId` still set to `"id"` — Mapbox's feature-state calls
(`map.setFeatureState({ source: "volta-districts", id: ... })`) depend on
this id matching what the component passes as `selectedId` / `hoverId`.

**4. Re-key the district data everywhere else it's declared** — the
`districts()` array in the page, and any other array or object in
`volta-map.js` keyed by district id (the `POIS` array is unrelated, it's
already keyed by name, leave it) — to use the same real slugs.

Re-key it; do not replace it wholesale from the payload. `public.places` has
no `lat`, `lon`, `line` or `status` columns, so the marker coordinates, the
label leader lines and the status chip exist only in the design export. Take
`name`, `capital`, `zone` and `url_path` from the payload if you want a single
source for those; keep the geometry-adjacent fields where they are.

**5. Confirm the two-way binding still works end to end** after re-keying:
hover a row in the list → the matching map shape highlights; hover a map
shape → the matching row highlights; click either → the drawer opens for the
right district; keyboard focus on a POI marker still reveals its label
(that fix already shipped in `volta-map-2.js` and must survive this change
untouched).

Check the five ids that were already correct (`adaklu`, `anloga`,
`central-tongu`, `ho-west`, `south-tongu`) as carefully as the six that
changed. They are the ones a re-key can quietly break by "correcting" a value
that was right.

**6. Confirm the `Explore/Happening/Building/Needs/Join` tab state and any
URL/deep-linking logic**, if built, also uses the real slug — a link like
`/regions/volta/ho` must become `/regions/volta/ho-municipal`.

Note that `places.url_path` is a bare path with no leading slash and no
`regions/` segment — `volta/ho-municipal`, not `/regions/volta/ho-municipal`.
No route serves a place path yet (`src/routes/$locale/home.tsx` says so in a
comment on the watched-places list, which renders place names as plain text
for exactly this reason), so the prefix is an open decision, not something to
read off `url_path`. Build the href from the slug and whatever prefix the
place route settles on; do not concatenate `url_path` onto `/regions/` and
call it verified.

## What not to do

Don't build a runtime lookup table that maps short id → slug. It is one more
thing to keep in sync, it has no reason to exist once the source data is
correct, and it is exactly the kind of shortcut that quietly becomes
permanent. Fix the ids at the source (the geojson and the district data), not
at the boundary where they're consumed.

Don't guess spellings or slugs from pattern-matching short ids. Read
`region_payload('volta')` and match on name/capital. Where the design export
and the database disagree on a name (Afadzato vs Afadjato is the one known
case; there may be others), the database wins, since it is what every other
surface in the app reads.

## Known unresolved items to carry forward, not fix here

- `north-dayi` and `south-tongu` have `zone: null` and `summary: null` in
  `public.places`. The three zones in `region_payload('volta').zones[]` count
  7 + 3 + 6 = 16 districts, not 18. Any list grouped by zone from the payload
  drops those two rows on the floor. This is a data gap, not an id problem —
  and `south-tongu` is one of the districts whose id was already correct, so
  it will survive the re-key and still be missing from the grouping. Do not
  fix it here; it needs a `places` data pass. Until it lands, render
  ungrouped districts somewhere visible rather than letting them vanish.
- `fetch("./volta-districts.geojson")` uses a relative path that assumes the
  file sits at the same directory depth as `volta-map.js` in deployment.
  Confirm this holds in the built route, or make the path absolute /
  resolved through whatever asset pipeline the app uses. This is a separate
  task from id reconciliation — do not conflate the two fixes in one commit.
- Two districts currently render `status: "Partnered"` (Ho Municipal, Ketu
  South Municipal) as design placeholder data. This is deliberate for now.
  Do not correct it as part of this task; it gets corrected in a separate
  data pass once the page's design is finished, per standing instruction.
