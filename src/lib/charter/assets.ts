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
  /**
   * The focal point the crop holds on to, as a CSS `object-position`.
   *
   * Every slot is `object-fit: cover`, so the frame changes shape with the
   * viewport and this is the part of the picture that survives. It is the one
   * piece of direction a photographer needs from us: whatever matters has to
   * sit here, with room around it.
   */
  readonly focus: string;
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
    // 1920 was cut deliberately: it weighed 299KB against 127KB at 1440, and
    // this page is built for a metered connection before it is built for a
    // desktop. 1440 upscales cleanly at the crop this slot uses.
    widths: [960, 1440],
    sizes: "(min-width: 1101px) 60vw, 100vw",
    focus: "center 18%",
    altKey: "charter.images.declarationAlt",
    licensed: true,
    eager: true,
    blockedBy: "",
  },
  /** The still: the dark section behind the definition of a region. */
  kumasi: {
    name: "kumasi",
    // Square source, so one width. Declaring widths the file does not have
    // would ship the same pixels three times under three names.
    widths: [800],
    sizes: "100vw",
    focus: "62% 45%",
    altKey: "charter.images.kumasiAlt",
    licensed: true,
    blockedBy: "",
  },
  /** Full-bleed: woven cloth. Cleared by named cultural review, 20260829. */
  greeting: {
    name: "greeting",
    widths: [740, 1280],
    sizes: "100vw",
    focus: "center 38%",
    creditKey: "charter.bleed.credit",
    altKey: "charter.images.greetingAlt",
    licensed: true,
    blockedBy: "",
  },
  /** Branches: the lit REGION 17 marquee at the launch. */
  seated: {
    name: "seated",
    widths: [720, 1280],
    sizes: "(min-width: 1101px) 1180px, 100vw",
    focus: "center 45%",
    creditKey: "charter.branches.credit",
    altKey: "charter.images.seatedAlt",
    licensed: true,
    blockedBy: "",
  },
  /** Charter: the lifetime patron plaque presented at the launch. */
  register: {
    name: "register",
    widths: [720, 1024],
    sizes: "(min-width: 1101px) 52vw, 100vw",
    focus: "center 45%",
    creditKey: "charter.window.credit",
    altKey: "charter.images.registerAlt",
    licensed: true,
    blockedBy: "",
  },
  /** Index: Black Star Gate at dusk, mirrored so the birds fly in from the right. */
  gate: {
    name: "gate",
    widths: [720, 1024],
    sizes: "(min-width: 1101px) 1180px, 100vw",
    focus: "center 40%",
    creditKey: "charter.index.credit",
    altKey: "charter.images.gateAlt",
    licensed: true,
    blockedBy: "",
  },
  /**
   * The pattern layer behind the ledger.
   *
   * Woven West African cloth, the same frame the project owner cleared on
   * 20260829. Not an adinkra motif: no symbol is reproduced. The scroll loop
   * writes --charter-pattern-opacity and the layer never sits behind body type
   * at more than a trace opacity.
   */
  ledgerPattern: {
    name: "ledger-pattern",
    widths: [1440],
    sizes: "100vw",
    focus: "center",
    altKey: "charter.images.ledgerPatternAlt",
    licensed: true,
    blockedBy: "",
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
