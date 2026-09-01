# Volta region page — the four decisions, and what they resolved to

The Claude Design export of the Volta region page (`Region_Page_-_Volta_v3_dc-7.html`,
`volta-map-2.js`) came with four things it could not decide for itself. This
records what each resolved to and what it was decided against, so the next
region page does not re-open them.

Read alongside `docs/volta-district-id-reconciliation.md`, which is the brief
this page's district ids were built to.

---

## 1. District URL routing

**Decided: `/{locale}/regions/{places.url_path}`.** Built in
`src/lib/places/path.ts` and nowhere else.

The design's "Open district" links assumed `/regions/volta/{id}`. That is wrong
here in two ways. Every member-facing route in this app is locale-first, under
`src/routes/$locale/` (D-067), so a path with no locale segment could not mount.
And the identifier is `places.slug`, not the design's short id.

`places.url_path` is a bare path with no leading slash and no prefix
(`volta`, `volta/ho-municipal`). It is the place's address inside the place
tree, not a URL. The prefix is this app's decision, and it is `regions/`.

So:

| | |
| --- | --- |
| Region page | `/en/regions/volta` — mounted at `src/routes/$locale/regions/$region.tsx` |
| District page | `/en/regions/volta/ho-municipal` — **no route serves this yet** |

The region route takes a `$region` param so the URL is the shape every region
page will use, but any slug other than `volta` is a 404. The page is not a
template yet: its feed, needs, registry figures and story bodies are
Volta-specific mock content. Removing that guard without doing the
generalisation pass would publish fifteen pages of invented Volta data under
other regions' names.

## 2. `page_built`

**Decided: a new `boolean` column on `public.places`, emitted per district by
`region_payload`, defaulting to false, flipped by a named function.**

It is not `depth_slug` and must never be derived from it. Depth is how far
Region 17 has got with the district (listed, profiled, partnered). `page_built`
is whether the district's own page exists and is safe to send a reader to. A
partnered district can have no page; a listed one can have a page written for
it. They are independent facts and the schema keeps them apart.

The migration is `supabase/migrations/*_places_page_built.sql`. It carries the
column, its comment, an additive `page_built` key on each district in
`region_payload` (contract `region-payload/3`), and
`set_place_page_built(p_slug, p_built)` as the one auditable way to flip it,
granted to `service_role` only. `places` has no write grant for `anon` or
`authenticated` and this does not add one.

The client reads `page_built` through `src/lib/region/payload.ts`, which accepts
both `region-payload/2` and `/3` and treats an absent key as false. The page
therefore works either side of the migration.

**Do not flip `page_built` for a district before the district route exists.**
True with no route is a 404 for every reader who clicks through. All eighteen
Volta districts are false today, which is correct: the spotlight sheet shows its
not-yet-built state for all of them.

## 3. District ids

**Decided: `places.slug` everywhere, per the reconciliation doc. The design's
short ids are retired, not wrapped.**

There is no translation table at runtime and there must not be one. The
identifier is the same string in all three places it appears:

- `public/geo/volta-districts.geojson` — each feature's `id` property, read by
  `promoteId: "id"`
- `src/lib/region/voltaDistrictMarks.ts` — the marker coordinates and editorial
  lines, the only district fields the database has no column for
- every prop through `VoltaMap` (`selectedId`, `hoverId`, `dimIds`) and every
  row in the district list

Names, capitals, zones, summaries, url_paths and depths come from
`region_payload('volta')` and are not repeated in application code.

The mapping was verified two ways rather than pattern-matched: by name and
capital against the RPC, and by checking that every design marker coordinate
falls inside the polygon now carrying its slug. All eighteen matched.

One spelling worth recording: the design export says "Afadzato South", and so
does the boundary source. `public.places` says **Afadjato South**, and the
database wins for anything a member reads. The design was not wrong about the
world; it was following a different source. The slug is `afadjato-south`.

Two zone facts moved since the reconciliation doc's snapshot, both in the
database's favour:

- `north-dayi` and `south-tongu` now have a zone. The payload's `zones[]` counts
  9 + 3 + 6 = 18, so nothing falls out of the grouping. The list still renders a
  trailing "not yet zoned" group if a district loses its zone again, rather than
  dropping the row.
- The design's zone assignments disagree with the database for four districts
  (`akatsi-north`, `akatsi-south`, `central-tongu`, `south-tongu`). The database
  wins; the list groups from `places.zone`.

## 4. `volta-districts.geojson`

**Decided: `public/geo/volta-districts.geojson`, fetched as
`/geo/volta-districts.geojson`.**

The design's `fetch("./volta-districts.geojson")` only worked because the canvas
kept everything at one folder depth. In the built route the page is served at
`/en/regions/volta`, so a relative fetch resolves to
`/en/regions/volta-districts.geojson` and 404s. The path is absolute for that
reason.

`public/` is Vite's static directory: served at the root in dev and copied into
the build output, where Cloudflare's static assets serve it. No import, no
hashing, so the URL is stable and the file is cacheable on its own.

**Source.** The design export's own geojson was not in the handoff, so the
boundaries were rebuilt from geoBoundaries gbOpen GHA ADM2 (simplified release),
re-keyed to `places.slug`, coordinates rounded to four decimal places: 81 KB for
all eighteen districts, which matters on a metered connection. The map credit
line names that source. It no longer says "UN OCHA / GSS, ITOS", because that is
not where these boundaries came from and the credit has to be true.

---

## Related decisions this pass also had to make

**Mapbox GL is loaded from Mapbox's CDN on demand, not bundled.** See the header
of `src/components/region/mapboxLoader.ts`. It is over a megabyte, most readers
never scroll to the map, and the schematic fallback needs neither the library
nor tiles. The token is `VITE_MAPBOX_TOKEN`; the design export carried one
inline, which is the habit `.env.example` exists to end. With no token the page
renders the fallback map, which is a correct state and not an error.

**The page is responsive.** The export is a 1440px canvas with no responsive
rules in it; at 390px the map collapsed to nothing and the district list was cut
in half. `src/styles/region.css` carries the layout that has to change with
width, mobile-first, with the design's desktop values restored at the
breakpoints. Above 1000px the page renders as the design settled it.

**Photographs are named, not borrowed.** `media_assets` holds nothing cleared
and the launch photography is unlicensed, so every image slot renders the brief
for the photograph that belongs there. `PhotoSlot` takes a cleared asset the day
one exists.
