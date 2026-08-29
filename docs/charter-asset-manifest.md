# Charter route: asset manifest

Every image slot on `r17gh.com/<locale>/join`. This is the brief for a
photographer and the checklist for a licensor.

Source of truth is `src/lib/charter/assets.ts`. A slot added there and not added
here fails `tests/charter.test.ts`, so this table cannot quietly go stale.

**Nothing on this page ships today.** All seven slots render as plain paper at
the correct aspect ratio, carrying their alternative text, and make no network
request. Each goes live by setting `licensed: true` on its slot, one at a time.

---

## What we need delivered

Per slot: **WebP**, at each width listed, named `<slot>-<width>.webp`, into
`public/images/charter/`. sRGB. No text burned into the image.

**Total budget for the page is 180 KB.** Seven slots is roughly 26 KB each; the
full-bleed and hero slots can take more if the plates take less. The budget is
the constraint, not a guideline: a large share of members are mobile-first on
metered or unreliable connections.

Every slot is `object-fit: cover`. The frame changes shape with the viewport, so
the **focal point** column is the part of the picture that always survives.
Whatever matters must sit there, **with room around it** on all four sides.

---

## The slots, in the order a reader meets them

| # | Slot | Where it appears | Frame | Widths | Focal point | Shoot for |
|---|---|---|---|---|---|---|
| 1 | `declaration` | Hero, behind the third stanza. Right 60% of the screen, masked to transparent at its left edge | Full viewport height, cover | 960, 1440 | `center 18%` | The speaker's face high in the frame. The left 40% sits under the type column on wide screens and must carry nothing important |
| 2 | `kumasi` | The definition section, behind dark navy at up to 72% opacity | Full-bleed, cover | 800 | `62% 45%` | Right of centre. Type is protected on the left. This slot drifts between `56% 48%` and `68% 42%` over 26s, so the subject must stay inside that travel |
| 3 | `greeting` | The full-bleed moment, "We find each other by name now" | 100svh, cover | 740 | `center 42%` | Two faces and the space between them, slightly above centre. A dark pool sits bottom-left behind the headline, so keep that corner quiet |
| 4 | `seated` | Below the six branches of the family | 16:9, max 64vh | 720, 1280 | `center 45%` | The marquee lettering centred. This is a wide crop and the sign must not clip |
| 5 | `register` | The Charter block, beside "There is only one Charter" | 16:9, max 64vh | 720, 1024 | `center 40%` | The arch centred, sky above it |
| 6 | `gate` | Below the region index, before the coda | 16:9, max 64vh | 720, 1180, 1600 | `center 30%` | Awaiting a file. Subject centred, sky above it |
| 7 | `ledger-pattern` | Behind the ledger of sixteen regions | Full-bleed tile, cover | 1440 | `center` | **Do not commission.** See the gate below |

Every plate is rendered at 120% height with a 10% negative offset so it can
carry an 11px parallax and a 1.05±0.012 Ken Burns scale without the frame
showing. **Deliver at the widths above, not cropped to the aspect ratio** — the
extra height is used.

---

## Captions and alternative text now in place

Captions are visible on the page. Alternative text is what a member using a
screen reader hears, and what search and the WhatsApp preview read.

| Slot | Caption on the page | Alternative text |
|---|---|---|
| `declaration` | none | President Mahama, photographed beside the flag of Ghana. |
| `kumasi` | none | The Accra to Kumasi expressway under construction at sunset. |
| `greeting` | Woven West African cloth | Woven West African cloth in red, gold and green. |
| `seated` | Region 17 launch, Washington D.C., 30 July 2026 | A lit REGION 17 marquee sign at the launch. |
| `register` | Black Star Gate, Accra. Freedom and Justice, AD 1957 | Black Star Gate, Accra, at dusk. |
| `gate` | Photograph to follow | A photograph of Ghana, still to be added. |
| `ledger-pattern` | none | A repeating pattern behind the register of regions. |

If a delivered photograph differs from its description, **the alternative text
changes with it.** These are descriptions of specific frames, not placeholders.

---

## Licensing gates

Nothing goes live until its row clears. Each is a decision someone makes on the
record, not a flag someone flips.

| Slot | Blocked by | What clears it |
|---|---|---|
| `declaration` | Cleared 20260829 | Licence confirmed by the project owner |
| `kumasi` | Cleared 20260829 | Licence and provenance confirmed by the project owner |
| `greeting` | Cleared 20260829 | Traditional-motif use confirmed as reviewed by the project owner; reviewer name to be recorded |
| `seated` | Cleared 20260829 | Licence confirmed by the project owner |
| `register` | Cleared 20260829 | Licence confirmed by the project owner |
| `gate` | No file supplied yet | The index-plate photograph, still to come |
| `ledger-pattern` | Traditional motif | **Named Ghanaian cultural review.** Not a licensing question |

### Two notes a licensor should read

**The three D.C. launch photographs (3, 4, 5) all sit behind one licence.** They
are the only images of real members on the page, and the page is about being
counted by name. Clearing that one licence is what makes the page look like
Region 17 rather than a stock brochure.

**Slots 2 and 6 are suspected AI generation.** They are held not because the
licence is missing but because the organisation's product is verification. A
synthetic photograph on a public surface, presented as a place, contradicts the
thing membership is supposed to mean. Replace them with real photography rather
than clearing them.

**Slot 7 is not a licensing question at all.** An adinkra pattern is not
decoration: the symbols carry specific meanings and belong to specific
communities. It needs named Ghanaian cultural review before any public use, and
if that review does not happen the page ships without it, as it does today. It
is listed here only so nobody commissions one by mistake.

---

## Also outstanding

**There is no share card.** `og:image` is deliberately absent rather than
pointing at a file that does not exist. The page arrives by WhatsApp forward, so
the share card is the first thing most readers see and it is currently blank.

It needs its own 1200×630 frame, but **not a licence**: Design's S2 is
deliberately typographic and carries no photography, so it clears immediately
and is not gated with the rows above. It is the one asset on this page that can
ship today.
