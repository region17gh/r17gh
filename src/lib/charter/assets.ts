/**
 * The charter page's photography.
 *
 * Every image on this page is licensing-unresolved, and two of the seven are
 * suspected AI generation, which the verification thesis forbids on a public
 * surface. So none of them ship. Each slot below is declared in full, with its
 * caption and its alternative text, and renders as a plain paper placeholder
 * until `licensed` flips to true. Nothing about the layout changes when it
 * does: the aspect ratio, the caption and the alt text are already here.
 *
 * The pipeline expects real files, not base64. Drop
 * `<name>-<width>.webp` into `public/images/charter/` for each declared width
 * and set `licensed: true`.
 */

/** Total budget for this page's imagery, gzip-irrelevant (WebP is already compressed). */
export const IMAGE_BUDGET_BYTES = 180 * 1024;

/** Where the built files live, relative to the site root. */
const IMAGE_BASE = "/images/charter";

export interface CharterImage {
  /** File stem under public/images/charter. */
  readonly name: string;
  /** Rendered widths, ascending. The largest is the fallback `src`. */
  readonly widths: readonly number[];
  /** The `sizes` attribute: how wide this slot is at each breakpoint. */
  readonly sizes: string;
  /** Dictionary key for the caption. Absent when the slot carries no credit. */
  readonly creditKey?: string;
  /** Dictionary key for the alternative text. */
  readonly altKey: string;
  /**
   * False until the photographer licence is cleared and provenance is settled.
   * While false the slot renders as paper and no network request is made.
   */
  readonly licensed: boolean;
  /** Above the fold, so it is never lazy-loaded. */
  readonly eager?: boolean;
  /** Why this slot is not yet licensed. Read by the pre-launch gate check. */
  readonly blockedBy: string;
}

/**
 * The seven slots, in the order the reader meets them.
 *
 * `blockedBy` is deliberately verbose. These are the gates from the handoff
 * spec, and a slot going live is a decision someone has to make on the record.
 */
export const CHARTER_IMAGES = {
  /** Hero: the President, behind stanza three. */
  declaration: {
    name: "declaration",
    widths: [960, 1440, 1920],
    sizes: "(min-width: 1101px) 60vw, 100vw",
    altKey: "charter.images.declarationAlt",
    licensed: false,
    eager: true,
    blockedBy: "Press photograph, rights unsecured.",
  },
  /** The still: the dark section behind the definition of a region. */
  kumasi: {
    name: "kumasi",
    widths: [960, 1440, 1920],
    sizes: "100vw",
    altKey: "charter.images.kumasiAlt",
    licensed: false,
    blockedBy: "Provenance unresolved; possibly synthetic.",
  },
  /** Full-bleed: two guests greeting each other after the programme. */
  greeting: {
    name: "greeting",
    widths: [960, 1440, 1920],
    sizes: "100vw",
    creditKey: "charter.bleed.credit",
    altKey: "charter.images.greetingAlt",
    licensed: false,
    blockedBy: "Photographer licence (Abeiku Edqlics) not cleared.",
  },
  /** Branches: two guests seated together during the programme. */
  seated: {
    name: "seated",
    widths: [720, 1180, 1600],
    sizes: "(min-width: 1101px) 1180px, 100vw",
    creditKey: "charter.branches.credit",
    altKey: "charter.images.seatedAlt",
    licensed: false,
    blockedBy: "Photographer licence (Abeiku Edqlics) not cleared.",
  },
  /** Charter: the register, open, at the launch check-in. */
  register: {
    name: "register",
    widths: [720, 1180, 1600],
    sizes: "(min-width: 1101px) 52vw, 100vw",
    creditKey: "charter.window.credit",
    altKey: "charter.images.registerAlt",
    licensed: false,
    blockedBy: "Photographer licence (Abeiku Edqlics) not cleared.",
  },
  /** Index: Black Star Gate at dusk. */
  gate: {
    name: "gate",
    widths: [720, 1180, 1600],
    sizes: "(min-width: 1101px) 1180px, 100vw",
    creditKey: "charter.index.credit",
    altKey: "charter.images.gateAlt",
    licensed: false,
    blockedBy: "Provenance unresolved; possibly synthetic.",
  },
  /**
   * The pattern layer behind the ledger.
   *
   * HOOK, not a gap. The prototype ran an adinkra pattern here. Traditional
   * motifs may not be used as decoration without named Ghanaian cultural
   * review, so the layer is declared and left off. Reinstating it after review
   * is this flag plus the `pattern` prop on <Ledger>: no rebuild of the
   * section, and the scroll loop already writes --charter-pattern-opacity.
   */
  ledgerPattern: {
    name: "ledger-pattern",
    widths: [1440],
    sizes: "100vw",
    altKey: "charter.images.ledgerPatternAlt",
    licensed: false,
    blockedBy: "Traditional motif. Requires named Ghanaian cultural review before any public use.",
  },
} as const satisfies Record<string, CharterImage>;

export type CharterImageKey = keyof typeof CHARTER_IMAGES;

/** `srcset` for a slot: one entry per declared width. */
export function srcSet(image: CharterImage): string {
  return image.widths.map((w) => `${IMAGE_BASE}/${image.name}-${w}.webp ${w}w`).join(", ");
}

/** The fallback `src`: the largest declared width. */
export function fallbackSrc(image: CharterImage): string {
  const widest = image.widths[image.widths.length - 1];
  return `${IMAGE_BASE}/${image.name}-${widest}.webp`;
}

/** Slots still waiting on a licence or on provenance. Empty is launch-ready. */
export function unlicensedImages(): CharterImage[] {
  return Object.values(CHARTER_IMAGES).filter((image) => !image.licensed);
}
