/**
 * Logic tests for the join flow, run with `bun test`.
 *
 * They live outside `src/` on purpose. Pulling Bun's type definitions into the
 * app's TypeScript program overrides the global `fetch` type and breaks the
 * three generated Supabase client files, which are marked do-not-edit. Keeping
 * the tests out of that program leaves `tsc --noEmit` clean over the app.
 */
import { describe, expect, test, beforeEach } from "bun:test";

import { MONTHS, birthYears, checkAge } from "../src/lib/join/age";
import {
  clearDraft,
  clearPendingHandle,
  emptyDraft,
  loadDraft,
  loadPendingHandle,
  reservationIsLive,
  saveDraft,
  savePendingHandle,
} from "../src/lib/join/draft";
import { checkHandle, normaliseHandle, suggestHandle } from "../src/lib/join/handle";
import { CONNECTIONS, CONSENTS, GENDERS } from "../src/lib/join/options";
import en from "../src/i18n/locales/en.json";
import { formatMemberNumber } from "../src/components/join/memberNumber";

/** A browser-shaped local storage, so the draft helpers run their real paths. */
function installStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
  (globalThis as unknown as { window: unknown }).window = { localStorage };
  return store;
}

describe("age gate", () => {
  const now = new Date(Date.UTC(2026, 7, 25)); // 25 August 2026

  test("needs both month and year before it can decide", () => {
    expect(checkAge(null, null, now)).toBe("missing");
    expect(checkAge(8, null, now)).toBe("missing");
    expect(checkAge(null, 1990, now)).toBe("missing");
  });

  test("admits an adult", () => {
    expect(checkAge(6, 1990, now)).toBe("ok");
  });

  test("refuses someone under 18", () => {
    expect(checkAge(1, 2020, now)).toBe("under");
    expect(checkAge(8, 2009, now)).toBe("under");
  });

  test("takes the last day of the birth month, exactly as the database trigger does", () => {
    // Born some time in August 2008: they could have been born on the 31st, so
    // on 25 August 2026 they are not yet certainly 18.
    expect(checkAge(8, 2008, now)).toBe("under");
    // Born in July 2008: 18 by 31 July 2026 at the latest.
    expect(checkAge(7, 2008, now)).toBe("ok");
  });

  test("offers twelve months and a year range that starts below the gate", () => {
    expect(MONTHS).toHaveLength(12);
    const years = birthYears(now);
    expect(years[0]).toBe(2011);
    expect(years[years.length - 1]).toBe(1925);
  });
});

describe("handle rules", () => {
  test("accepts what the database constraint accepts", () => {
    expect(checkHandle("ama")).toBeNull();
    expect(checkHandle("ama-mensah")).toBeNull();
    expect(checkHandle("a1b")).toBeNull();
  });

  test("rejects what the database constraint rejects", () => {
    expect(checkHandle("")).toBe("empty");
    expect(checkHandle("ab")).toBe("tooShort");
    expect(checkHandle("a".repeat(31))).toBe("tooLong");
    expect(checkHandle("-ama")).toBe("format");
    expect(checkHandle("ama-")).toBe("format");
    expect(checkHandle("Ama")).toBe("format");
    expect(checkHandle("ama mensah")).toBe("format");
  });

  test("suggests an address from the name, and nothing when it would be invalid", () => {
    expect(suggestHandle("Ama", "Mensah")).toBe("amamensah");
    expect(suggestHandle("Kofi", "O'Brien")).toBe("kofiobrien");
    expect(suggestHandle("Al", "")).toBe("");
  });

  test("normalises as the member types", () => {
    expect(normaliseHandle("Ama Mensah!")).toBe("amamensah");
    expect(normaliseHandle("AMA-MENSAH")).toBe("ama-mensah");
    expect(normaliseHandle("a".repeat(40))).toHaveLength(30);
  });
});

describe("the draft", () => {
  beforeEach(() => {
    installStorage();
    clearDraft();
    clearPendingHandle();
  });

  test("survives a round trip", () => {
    const draft = { ...emptyDraft(), firstName: "Ama", city: "Accra", regions: ["ashanti"] };
    saveDraft(draft);
    const restored = loadDraft();
    expect(restored.firstName).toBe("Ama");
    expect(restored.city).toBe("Accra");
    expect(restored.regions).toEqual(["ashanti"]);
  });

  test("clearing leaves nothing behind", () => {
    saveDraft({ ...emptyDraft(), email: "someone@example.com" });
    clearDraft();
    expect(loadDraft().email).toBe("");
  });

  test("drops anything unrecognised rather than trusting it", () => {
    (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage.setItem(
      "r17.join.draft.v1",
      JSON.stringify({
        firstName: { evil: true },
        regions: ["ashanti", 42, null],
        reservation: { memberNumber: "not-a-number" },
        somethingElse: "ignored",
      }),
    );
    const restored = loadDraft();
    expect(restored.firstName).toBe("");
    expect(restored.regions).toEqual(["ashanti"]);
    expect(restored.reservation).toBeNull();
  });

  test("the chosen address outlives the draft, because verification still needs it", () => {
    savePendingHandle("ama-mensah");
    saveDraft({ ...emptyDraft(), firstName: "Ama" });
    clearDraft();
    expect(loadDraft().firstName).toBe("");
    expect(loadPendingHandle()).toBe("ama-mensah");
  });

  test("knows when a held number has lapsed", () => {
    const now = new Date(Date.UTC(2026, 7, 25, 12));
    const live = { memberNumber: 248, credentialId: "x", expiresAt: "2026-08-25T13:00:00Z" };
    const dead = { memberNumber: 248, credentialId: "x", expiresAt: "2026-08-25T11:00:00Z" };
    expect(reservationIsLive(live, now)).toBe(true);
    expect(reservationIsLive(dead, now)).toBe(false);
    expect(reservationIsLive(null, now)).toBe(false);
  });
});

describe("consents", () => {
  test("everything that shares or exposes a record is off by default", () => {
    const defaultOn = CONSENTS.filter((c) => c.defaultOn);
    expect(defaultOn).toHaveLength(1);
    expect(defaultOn[0]?.value).toBe("townhall_invites");
  });

  test("a new draft grants only the town hall invitation", () => {
    expect(emptyDraft().consents).toEqual(["townhall_invites"]);
  });

  test("directory visibility is offered as a consent and nothing more", () => {
    const directory = CONSENTS.find((c) => c.value === "directory_visibility");
    expect(directory).toBeDefined();
    expect(directory?.defaultOn).toBe(false);
    // There is no visibility column anywhere in the consent definitions: a
    // consent is a consent, and member_visibility keeps its own defaults.
    expect(Object.keys(directory ?? {})).toEqual(["value", "key", "group", "defaultOn"]);
  });
});

describe("gender", () => {
  test("a member starts on prefer_not_to_say, so declining reads as not yet answered", () => {
    expect(emptyDraft().gender).toBe("prefer_not_to_say");
    expect(GENDERS[0]?.value).toBe("prefer_not_to_say");
  });

  test("the list is the enum and nothing else", () => {
    expect(GENDERS.map((g) => g.value)).toEqual([
      "prefer_not_to_say",
      "woman",
      "man",
      "non_binary",
      "self_described",
    ]);
    // No option can carry a free-text partner: there is nowhere to put one.
    for (const option of GENDERS) {
      expect(Object.keys(option)).toEqual(["value", "key"]);
    }
  });

  test("no label offers to collect a description", () => {
    // member_gender stores the enum only. A label promising self-description
    // would be offering a box that does not exist, and asking for a free-text
    // statement of identity that could be neither counted nor suppressed.
    for (const option of GENDERS) {
      const label = (en.join.genders as Record<string, string>)[option.key];
      expect(label).toBeDefined();
      expect(label).not.toMatch(/describe|own words|specify|tell us/i);
    }
  });
});

describe("connections", () => {
  /**
   * Absence markers. A connection type says what a member is, never what they
   * are missing: "African descent, no known Ghana link" and "In Africa, not
   * Ghanaian" both failed this and were rewritten.
   *
   * Scoped to connection types on purpose. Consent descriptions legitimately
   * say what will not happen with a member's record ("They never see your
   * contact details"), which is a promise, not a definition by lack. Do not
   * widen this guard to them.
   */
  const DEFINED_BY_ABSENCE = /\b(no|not|none|without|lacks?|lacking|never)\b|n't\b/i;

  test("no connection type is defined by what a member lacks", () => {
    for (const connection of CONNECTIONS) {
      const label = (en.join.connections as Record<string, string>)[connection.key];
      const note = (en.join.connections as Record<string, string>)[`${connection.key}Note`];
      expect(label).toBeDefined();
      expect(note).toBeDefined();
      expect(label).not.toMatch(DEFINED_BY_ABSENCE);
      expect(note).not.toMatch(DEFINED_BY_ABSENCE);
    }
  });

  test("the guard would catch the wording it replaced", () => {
    expect("African descent, no known Ghana link").toMatch(DEFINED_BY_ABSENCE);
    expect("In Africa, not Ghanaian").toMatch(DEFINED_BY_ABSENCE);
    expect("Friend of Ghana (no Ghanaian heritage)").toMatch(DEFINED_BY_ABSENCE);
  });

  test("all six are offered, flat", () => {
    expect(CONNECTIONS).toHaveLength(6);
    expect(CONNECTIONS.map((c) => c.value)).toEqual([
      "ghanaian_abroad",
      "ghanaian_heritage",
      "african_diaspora",
      "ghanaian_at_home",
      "african_continental",
      "ally",
    ]);
    // Nothing in the definition can express rank.
    for (const connection of CONNECTIONS) {
      expect(Object.keys(connection)).toEqual(["value", "key"]);
    }
  });
});

describe("member numbers", () => {
  test("pad to six digits with the leading zeros held apart", () => {
    expect(formatMemberNumber(248)).toEqual({ prefix: "000,", tail: "248" });
    expect(formatMemberNumber(1248)).toEqual({ prefix: "00", tail: "1,248" });
    expect(formatMemberNumber(123456)).toEqual({ prefix: "", tail: "123,456" });
  });
});
