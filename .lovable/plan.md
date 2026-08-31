# Scroll responsiveness, Ken Burns, and a Content & Media admin

Three pieces of work, delivered in order. The scroll fix ships first on its own so the page stops feeling stuck while the larger admin tool is built.

## 1. Make /en/join react on the first scroll

What is happening today (confirmed in the code): the opening section reserves 460vh of scroll (280vh on small screens) for a pinned hero of three stanzas. The first stanza only begins to fade after 74 percent of its own slice has passed, which is roughly one full screen height of scrolling before a single pixel changes. Nothing is lagging or dropping frames; the track is simply too long and the first stanza holds too long. The gold reading thread on the left and the browser scrollbar are the only things that move during that stretch, which is exactly what the screenshots show.

Changes:

- Shorten the pinned hero track from 460vh to roughly 300vh on desktop and 200vh on small screens, so the three stanzas plus the returning opening line occupy a distance that matches a normal touchpad gesture.
- Give stanza one a much shorter hold: it starts fading almost immediately on the first scroll, so the very first gesture produces visible movement.
- Shorten the ledger track proportionally (340vh today) so the pacing stays consistent down the page.
- Leave native scrolling alone. No scroll hijacking, no smooth-scroll library, no scroll-linked easing that would add real lag on a metered mobile connection. The perceived lag is track length, and that is what gets fixed.
- Keep the reduced-motion path unchanged (tracks already unroll to a plain stacked page).

Verification: measure the scroll distance from the top of the page to the first visible stanza change, and check the three-stanza sequence still completes before the pin releases, at desktop and mobile widths.

## 2. Ken Burns on the marquee image

The REGION 17 marquee plate (screenshot 3) currently gets only a barely perceptible breath (a 1.2 percent sine wobble shared by every photo). It will get a real, slow, continuous zoom-in that runs while the plate is in view, easing rather than looping visibly, and disabled entirely under reduced motion.

This is built as a named effect ("ken-burns") rather than a one-off, because step 3 turns effects into an admin toggle.

## 3. Content & Media Management (admin)

A permanent admin area for managing every image, video, and media link across the platform, so media never has to come back through chat. Built in stages.

### Stage 3a: foundation (database and storage)

- New `content_admin` role, added to the existing role system and checked by a security-definer function. Only holders of that role can reach any of this.
- A `media` storage bucket, private by default, with delivery through signed or public URLs depending on the surface. Upload and delete permitted only to `content_admin`.
- Extend the existing `media_assets` table (it already carries alt text, credit, licence, dimensions, clearance) with the fields this tool needs: focal point, effect settings, and derived-variant records.
- A `media_placements` table mapping a named slot (page, section, slot key, locale) to a media asset, with a per-placement effect toggle and settings. The page reads placements; shipped defaults stay in code as fallback so a page never renders empty.
- All of it behind RLS: public read only for cleared, published placements; write only for `content_admin`.

Database changes will be shown in full as a migration for approval before anything is built on top, per project protocol.

### Stage 3b: the admin surface

An authenticated `/en/admin/media` area with:

- A library: upload (drag and drop), search, filter by page or slot, replace, delete, and a usage list showing where each asset appears.
- Per-asset editing: crop and focal point on a live preview, output size and quality targets, alt text, caption, credit, licence and clearance flag.
- Automatic derivative generation on upload (the same WebP width ladder the page uses today) so uploads stay inside the page's bandwidth budget rather than shipping originals.
- Per-placement effect control: a toggle that turns an effect on for that image, and, when on, its settings (Ken Burns direction, zoom amount, duration; parallax amount). Off means the image is completely still.
- Videos and external media links as asset kinds alongside images, with the same placement model.
- Every mutation goes through validated server functions that re-check the `content_admin` role server-side. No direct client writes.

### Stage 3c: page adoption

Convert the join page's seven slots from the hardcoded manifest to placements, keeping the current files as the shipped defaults. Then the same mechanism is available to every page built afterwards.

## Technical notes

- Scroll work touches `src/styles/charter.css` (track heights) and `src/components/charter/useCharterStage.ts` (stanza timing, Ken Burns). Presentation only, no logic changes.
- Image processing runs server-side on upload. The serverless runtime cannot run `sharp`, so derivatives use a Worker-compatible WASM encoder or Supabase image transformation; whichever is chosen, the width ladder and WebP output match the current assets.
- No new heavy client dependencies. Cropping uses a small canvas-based control, not a large editor package.
- Existing tests in `tests/charter.test.ts` are updated for the new track lengths; new tests cover role gating and placement resolution.

## Suggested order

1. Scroll pacing plus Ken Burns on the marquee (small, immediate).
2. Migration for role, bucket, and placement tables (review and approve).
3. Admin media area, then convert the join page to placements.
