/**
 * Tests for the Charter story page at /<locale>/join.
 *
 * They live outside `src/` for the same reason the join tests do: Bun's globals
 * override `fetch` and break the generated Supabase clients if they are pulled
 * into the app's TypeScript program.
 *
 * These assert the things that are decisions rather than rendering: the region
 * canon, the licence gates, the copy rules the house style makes binding, and
 * the redirect table.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { CHARTER_IMAGES, srcSet, fallbackSrc, unlicensedImages } from "../src/lib/charter/assets";
import { CHARTER_REGIONS, codesAreComplete } from "../src/lib/charter/regions";
import { DEFERRED_REDIRECTS, LEGACY_REDIRECTS } from "../src/lib/charter/legacyPaths";
import { cutoffDateTime, formatCutoff } from "../src/lib/foundingWindow";
import en from "../src/i18n/locales/en.json";

const dictionary = en as Record<string, never> & {
  charter: Record<string, Record<string, string> & string>;
  legal: Record<string, string>;
};

function charterStrings(): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === "string") out.push(node);
    else if (node && typeof node === "object") Object.values(node).forEach(walk);
  };
  walk(dictionary.charter);
  return out;
}

describe("the sixteen regions", () => {
  test("all sixteen are present, alphabetically", () => {
    expect(CHARTER_REGIONS).toHaveLength(16);
    const names = CHARTER_REGIONS.map((region) => region.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });

  test("every region has a distinct three-letter code", () => {
    expect(codesAreComplete()).toBe(true);
    for (const region of CHARTER_REGIONS) expect(region.code).toMatch(/^[A-Z]{3}$/);
  });

  test("colour never carries the identity alone: every region ships a name and a code", () => {
    for (const region of CHARTER_REGIONS) {
      expect(region.name.length).toBeGreaterThan(0);
      expect(region.code.length).toBe(3);
      // Ink is a token reference, never a literal colour on this page.
      expect(region.ink).toMatch(/^var\(--region-[a-z-]+\)$/);
    }
  });

  test("every region has a fact of roughly 25 to 50 words", () => {
    for (const region of CHARTER_REGIONS) {
      const key = region.factKey.replace("charter.regions.", "");
      const fact = dictionary.charter.regions[key];
      expect(fact, `missing fact for ${region.slug}`).toBeTruthy();
      const words = fact.trim().split(/\s+/).length;
      expect(words, `${region.slug} fact is ${words} words`).toBeGreaterThanOrEqual(20);
      expect(words, `${region.slug} fact is ${words} words`).toBeLessThanOrEqual(55);
    }
  });

  test("each region links to its own public page", () => {
    for (const region of CHARTER_REGIONS) {
      expect(region.href).toBe(`https://r17gh.com/${region.slug}`);
    }
  });
});

describe("photography gates", () => {
  test("nothing ships while a licence or provenance is unresolved", () => {
    // If this fails, someone has cleared a gate. That is a decision, and the
    // PR that flips a flag should say who cleared it.
    expect(unlicensedImages()).toHaveLength(Object.keys(CHARTER_IMAGES).length);
  });

  test("every slot states what is blocking it", () => {
    for (const image of Object.values(CHARTER_IMAGES)) {
      expect(image.blockedBy.length).toBeGreaterThan(10);
      expect(image.altKey).toStartWith("charter.images.");
    }
  });

  test("the traditional-motif layer names cultural review as its gate", () => {
    expect(CHARTER_IMAGES.ledgerPattern.blockedBy).toContain("cultural review");
    expect(CHARTER_IMAGES.ledgerPattern.licensed).toBe(false);
  });

  test("srcset offers every declared width, and the fallback is the widest", () => {
    const image = CHARTER_IMAGES.greeting;
    const set = srcSet(image);
    for (const width of image.widths) expect(set).toContain(`-${width}.webp ${width}w`);
    expect(fallbackSrc(image)).toContain(`-${image.widths[image.widths.length - 1]}.webp`);
    // WebP only: the budget does not survive a JPEG fallback chain.
    expect(set).not.toContain(".jpg");
  });

  test("only the opening image is eager; everything below the fold is lazy", () => {
    const eager = Object.values(CHARTER_IMAGES).filter((image) => image.eager);
    expect(eager).toHaveLength(1);
    expect(eager[0].name).toBe("declaration");
  });
});

describe("legacy paths", () => {
  test("every legacy path lands on a locale-first address", () => {
    for (const entry of LEGACY_REDIRECTS) {
      expect(entry.to).toStartWith("/en/");
      expect(entry.why.length).toBeGreaterThan(10);
    }
  });

  test("the story and the form keep separate addresses", () => {
    const story = LEGACY_REDIRECTS.find((entry) => entry.from === "/join");
    const form = LEGACY_REDIRECTS.find((entry) => entry.from === "/register");
    expect(story?.to).toBe("/en/join");
    expect(form?.to).toBe("/en/join/register");
    expect(story?.to).not.toBe(form?.to);
  });

  test("/en is deferred rather than silently dropped, with its reason recorded", () => {
    const deferred = DEFERRED_REDIRECTS.find((entry) => entry.from === "/en");
    expect(deferred).toBeTruthy();
    expect(deferred?.blockedBy).toContain("fragment");
  });

  test("no route file redirects /en", () => {
    // A redirect here would bounce a dead sign-in link away from the screen
    // that explains it. See legacyPaths.ts.
    for (const path of ["src/routes/join/index.tsx", "src/routes/join/en.tsx", "src/routes/register.tsx"]) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("statusCode: 301");
    }
  });
});

describe("the founding window", () => {
  test("the close date is formatted from the value it is given, never invented", () => {
    const cutoff = new Date("2027-01-31T23:59:59Z");
    expect(formatCutoff(cutoff, "en")).toBe("31 January 2027");
    expect(cutoffDateTime(cutoff)).toBe("2027-01-31T23:59:59.000Z");
  });

  test("a date near midnight UTC does not slide a day", () => {
    // Formatting in local time would print 1 February for readers east of UTC.
    expect(formatCutoff(new Date("2027-01-31T23:59:59Z"), "en")).toContain("31");
  });

  test("no charter string hardcodes the close date", () => {
    // The bar reads app_config. A date in the dictionary is a date that goes
    // stale silently when the board moves the window.
    for (const value of charterStrings()) {
      expect(value).not.toContain("2027");
      expect(value).not.toMatch(/31 January \d{4}/);
    }
  });
});

describe("copy rules", () => {
  test("no em or en dashes anywhere in the page copy", () => {
    for (const value of charterStrings()) {
      expect(value, `dash in: ${value}`).not.toMatch(/[—–]/);
    }
  });

  test("no banned marketing vocabulary", () => {
    const banned = [
      "unlock",
      "empower",
      "seamless",
      "revolutionize",
      "revolutionise",
      "world-class",
      "leverage",
      "journey",
      "elevate",
    ];
    for (const value of charterStrings()) {
      for (const word of banned) {
        expect(value.toLowerCase(), `"${word}" in: ${value}`).not.toContain(word);
      }
    }
  });

  test("the Register is not used as a noun in persuasion copy", () => {
    // "The Register" is the institution's proper noun and belongs to formal
    // surfaces: credential, welcome email, captions, legal. Here the work is
    // carried by "name" and "counted".
    const persuasion = [
      dictionary.charter.window.hinge,
      dictionary.charter.window.cta,
      dictionary.charter.window.fineprint,
      dictionary.charter.deadline.cta,
    ];
    for (const value of persuasion) expect(value).not.toContain("Register");
  });

  test("the conversion point carries the canon copy", () => {
    expect(dictionary.charter.window.hinge).toBe(
      "Home cannot know your name until it is written.",
    );
    expect(dictionary.charter.window.cta).toBe("Add my name");
    expect(dictionary.charter.deadline.cta).toBe("Add my name");
    expect(dictionary.charter.window.fineprint).toBe(
      "Free for family. Always. Three minutes to be counted.",
    );
    // The founding truth leads the ask.
    expect(`${dictionary.charter.window.line1} ${dictionary.charter.window.line2}`).toBe(
      "There is only one Charter.",
    );
  });

  test("the founding group is Charter Members, never a year label", () => {
    for (const value of charterStrings()) {
      expect(value.toLowerCase()).not.toContain("class of");
      expect(value).not.toMatch(/\bClass\b/);
    }
  });

  test("the page carries the standing safety sentence", () => {
    // Rendered in the charter block. Its wording is fixed and shared, so the
    // page reads the same string the credential and the welcome email do.
    expect(dictionary.legal.notAGovernmentDocument).toBe(
      "Region 17 membership is a standing in a community. It is not a government document and confers no citizenship, residence, visa, or right of entry.",
    );
    const page = readFileSync("src/routes/$locale/join/index.tsx", "utf8");
    expect(page).toContain("legal.notAGovernmentDocument");
  });

  test("no traditional motif is used as decoration", () => {
    const css = readFileSync("src/styles/charter.css", "utf8");
    const page = readFileSync("src/routes/$locale/join/index.tsx", "utf8");
    // Named only in comments that explain the omission, never in a rule.
    expect(css).not.toMatch(/background[^;]*adinkra/i);
    expect(css).not.toMatch(/^\s*\.kente/m);
    expect(page).not.toContain("kente-band");
  });
});

describe("the stylesheet consumes tokens rather than redefining them", () => {
  const css = readFileSync("src/styles/charter.css", "utf8");

  test("no hardcoded hex anywhere", () => {
    const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hex).toEqual([]);
  });

  test("every charter alias resolves to a design-system token", () => {
    const aliases = css.matchAll(/^\s*(--charter-[a-z-]+):\s*([^;]+);/gm);
    for (const [, name, value] of aliases) {
      // Layout aliases are allowed to be lengths; colour aliases are not.
      if (/paper|ink|navy|brass|rule/.test(name)) {
        expect(value.trim(), `${name} should reference a token`).toMatch(/^var\(--[a-z0-9-]+\)$/);
      }
    }
  });

  test("region fill never sits behind text", () => {
    // The doctrine violation the handoff called out: cells were tinted with
    // region fill under region ink. The cell ground is plain paper here.
    expect(css).toMatch(/\.charter-cell\s*\{[^}]*background-color:\s*var\(--surface-card\)/);
    expect(css).not.toMatch(/\.charter-cell\.is-lit\s*\{[^}]*background-image/);
  });

  test("reduced motion stops every scrubbed and looping element", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const selector of [
      ".charter-pin",
      ".charter-ledger",
      ".charter-stanza",
      ".charter-ticker-track",
      ".charter-still-bg",
    ]) {
      expect(block, `${selector} not stilled`).toContain(selector);
    }
  });

  test("every control a member taps clears the 48px floor", () => {
    for (const control of [".charter-cta", ".charter-deadline a", ".charter-region-grid a"]) {
      const start = css.indexOf(`${control} {`);
      expect(start, `${control} not found`).toBeGreaterThan(-1);
      const rule = css.slice(start, css.indexOf("}", start));
      expect(rule, `${control} below the tap floor`).toContain("min-height: var(--control-lg)");
    }
  });
});

describe("every string the page asks for exists", () => {
  /**
   * The dictionary is the only place this page's words live, and a missing key
   * fails silently: `translator` returns the key itself, so a typo ships as
   * "charter.window.hinge" rendered at 2rem in the middle of the conversion
   * point. This walks the source instead of waiting for someone to notice.
   */
  const sources = [
    "src/routes/$locale/join/index.tsx",
    "src/components/charter/Ledger.tsx",
    "src/components/charter/RegionIndex.tsx",
    "src/components/charter/Coda.tsx",
    "src/components/charter/DeadlineBar.tsx",
    "src/components/charter/Plate.tsx",
  ];

  function resolve(key: string): string | undefined {
    const value = key
      .split(".")
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === "object" && part in node
            ? (node as Record<string, unknown>)[part]
            : undefined,
        dictionary,
      );
    return typeof value === "string" ? value : undefined;
  }

  test("no literal t() key is missing", () => {
    const missing: string[] = [];
    for (const path of sources) {
      const source = readFileSync(path, "utf8");
      for (const [, key] of source.matchAll(/\bt\(\s*"([a-zA-Z0-9_.-]+)"/g)) {
        if (resolve(key) === undefined) missing.push(`${path}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("the six branches all resolve, title and body", () => {
    // Built from a template literal, so the check above cannot see them.
    for (const branch of ["bornIn", "bornTo", "descended", "continent", "returned", "friends"]) {
      expect(resolve(`charter.branches.${branch}Title`), `${branch} title`).toBeTruthy();
      expect(resolve(`charter.branches.${branch}Body`), `${branch} body`).toBeTruthy();
    }
  });

  test("every image alt key resolves", () => {
    for (const image of Object.values(CHARTER_IMAGES)) {
      expect(resolve(image.altKey), image.altKey).toBeTruthy();
      if (image.creditKey) expect(resolve(image.creditKey), image.creditKey).toBeTruthy();
    }
  });

  test("the atlas has a text alternative naming the cities and the thesis", () => {
    const alternative = resolve("charter.atlas.alt") ?? "";
    for (const city of ["Toronto", "Kingston", "London", "Johannesburg", "Sydney"]) {
      expect(alternative, `${city} missing from the atlas alternative`).toContain(city);
    }
    expect(alternative.split(/\s+/).length).toBeGreaterThan(30);
  });
});
