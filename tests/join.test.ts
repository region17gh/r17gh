/**
 * Logic tests for the join flow, run with `bun test`.
 *
 * They live outside `src/` on purpose. Pulling Bun's type definitions into the
 * app's TypeScript program overrides the global `fetch` type and breaks the
 * three generated Supabase client files, which are marked do-not-edit. Keeping
 * the tests out of that program leaves `tsc --noEmit` clean over the app.
 */
import { describe, expect, test, beforeEach } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

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
import {
  HANDLE_SUGGESTIONS_WANTED,
  checkHandle,
  normaliseHandle,
  readHandleAvailability,
  suggestHandle,
  worthCheckingHandle,
} from "../src/lib/join/handle";
import { HANDLE_CHECK_DEBOUNCE_MS } from "../src/components/join/useHandleAvailability";
import { looksSendable, submitIdentity } from "../src/lib/join/identity";
import { readLinkError } from "../src/lib/auth/linkError";
import {
  OTP_ACCEPTED_LENGTH,
  OTP_MAX_LENGTH,
  OTP_MIN_LENGTH,
  checkCode,
  configuredOtpLength,
  normaliseCode,
  otpLengthOutOfRange,
} from "../src/lib/auth/otp";
import { CONNECTIONS, CONSENTS, GENDERS } from "../src/lib/join/options";
import { REGIONS_ALPHABETICAL } from "../src/lib/regions";
import en from "../src/i18n/locales/en.json";
import { formatMemberNumber } from "../src/components/join/memberNumber";

/** Every TypeScript source file under a directory, as repo-relative paths. */
function sourceFiles(root: string): string[] {
  const base = new URL(`../${root}/`, import.meta.url);
  const found: string[] = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const relative = `${root}/${entry.name}`;
    if (entry.isDirectory()) found.push(...sourceFiles(relative));
    else if (/\.tsx?$/.test(entry.name)) found.push(relative);
  }
  return found.sort();
}

/** A source file, read as text, for the assertions about where code sits. */
function readSource(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

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

describe("regions", () => {
  test("all sixteen are offered, in alphabetical order", () => {
    expect(REGIONS_ALPHABETICAL).toHaveLength(16);
    expect(REGIONS_ALPHABETICAL.map((r) => r.name)).toEqual([
      "Ahafo",
      "Ashanti",
      "Bono",
      "Bono East",
      "Central",
      "Eastern",
      "Greater Accra",
      "North East",
      "Northern",
      "Oti",
      "Savannah",
      "Upper East",
      "Upper West",
      "Volta",
      "Western",
      "Western North",
    ]);
  });

  /**
   * The design system's own order is the colour band running down the map, and
   * it is replaced in place as design work continues. Sorting is ours precisely
   * so that a replacement cannot quietly restore an order a member cannot scan.
   */
  test("the order does not depend on the design system's", () => {
    const source = [...REGIONS_ALPHABETICAL].map((r) => r.name);
    expect(source).toEqual([...source].sort((a, b) => a.localeCompare(b, "en")));
  });
});

describe("member numbers", () => {
  test("pad to six digits with the leading zeros held apart", () => {
    expect(formatMemberNumber(248)).toEqual({ prefix: "000,", tail: "248" });
    expect(formatMemberNumber(1248)).toEqual({ prefix: "00", tail: "1,248" });
    expect(formatMemberNumber(123456)).toEqual({ prefix: "", tail: "123,456" });
  });
});

describe("the age gate, at submit", () => {
  const now = new Date(Date.UTC(2026, 7, 25)); // 25 August 2026
  const ADDRESS = "ama@example.com";

  /** Records what was called, in order, so the sequence itself can be asserted. */
  function watch() {
    const calls: string[] = [];
    return {
      calls,
      keepEmail: (email: string) => void calls.push(`keep:${email}`),
      sendCode: async (email: string) => {
        calls.push(`send:${email}`);
        return { error: null };
      },
      now,
    };
  }

  test("an under-18 submission with all four answers keeps no address and calls nothing", async () => {
    const store = installStorage();
    // The state a member reaches by filling the screen in: name and date of
    // birth are in the draft as they are typed, the address is not, and every
    // field on the screen has something in it.
    saveDraft({
      ...emptyDraft(),
      firstName: "Ama",
      lastName: "Mensah",
      birthMonth: 8,
      birthYear: 2010,
    });
    const handlers = watch();

    const outcome = await submitIdentity(
      { birthMonth: 8, birthYear: 2010, email: ADDRESS },
      handlers,
    );

    expect(outcome.status).toBe("underage");
    // No network call: the code was never requested.
    expect(handlers.calls).toEqual([]);
    // No draft state: the address was never handed to the draft, and what the
    // earlier fields had already stored is gone with it.
    expect(loadDraft().email).toBe("");
    expect(loadDraft().firstName).toBe("");
    expect(store.get("r17.join.draft.v1")).toBeUndefined();
    // Nothing anywhere in storage carries the address.
    expect([...store.values()].some((value) => value.includes(ADDRESS))).toBe(false);
  });

  test("an adult submission keeps the address first, then asks for the code", async () => {
    installStorage();
    const handlers = watch();

    const outcome = await submitIdentity(
      { birthMonth: 6, birthYear: 1990, email: `  ${ADDRESS} ` },
      handlers,
    );

    expect(outcome.status).toBe("sent");
    expect(handlers.calls).toEqual([`keep:${ADDRESS}`, `send:${ADDRESS}`]);
  });

  test("a missing date of birth stops before the address is read at all", async () => {
    installStorage();
    saveDraft({ ...emptyDraft(), firstName: "Ama" });
    const handlers = watch();

    const outcome = await submitIdentity(
      { birthMonth: null, birthYear: null, email: ADDRESS },
      handlers,
    );

    expect(outcome.status).toBe("dob_missing");
    expect(handlers.calls).toEqual([]);
    // Not a refusal: what they have entered so far is still theirs.
    expect(loadDraft().firstName).toBe("Ama");
  });

  test("an adult with no usable address sends nothing and keeps nothing", async () => {
    installStorage();
    const handlers = watch();

    const outcome = await submitIdentity(
      { birthMonth: 6, birthYear: 1990, email: "   " },
      handlers,
    );

    expect(outcome.status).toBe("email_missing");
    expect(handlers.calls).toEqual([]);
  });

  test("a failed send is reported without pretending a code is on its way", async () => {
    installStorage();
    const outcome = await submitIdentity(
      { birthMonth: 6, birthYear: 1990, email: ADDRESS },
      {
        keepEmail: () => undefined,
        sendCode: async () => ({ error: { message: "smtp is down" } }),
        now,
      },
    );

    expect(outcome.status).toBe("send_failed");
  });

  test("the address check catches what cannot be sent, and nothing more", () => {
    expect(looksSendable("ama@example.com")).toBe(true);
    expect(looksSendable("ama+r17@example.co.uk")).toBe(true);
    expect(looksSendable("")).toBe(false);
    expect(looksSendable("ama")).toBe(false);
    expect(looksSendable("@example.com")).toBe(false);
    expect(looksSendable("ama@")).toBe(false);
    expect(looksSendable("ama mensah@example.com")).toBe(false);
  });
});

describe("a link that will not open", () => {
  test("reads an expired confirmation link out of the fragment", () => {
    const failure = readLinkError(
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(failure).toEqual({ problem: "expired", code: "otp_expired" });
  });

  test("reads a refusal that carries no code", () => {
    expect(readLinkError("#error=access_denied")).toEqual({ problem: "denied", code: "" });
  });

  test("reads the query string too, for the flow that puts it there", () => {
    expect(readLinkError("", "?error=server_error&error_code=unexpected_failure")).toEqual({
      problem: "unknown",
      code: "unexpected_failure",
    });
  });

  test("a link that worked is not a failure", () => {
    expect(readLinkError("#access_token=abc&type=magiclink")).toBeNull();
    expect(readLinkError("")).toBeNull();
  });
});

describe("the one-time code, and the length nobody in the UI gets to decide", () => {
  /**
   * The bug this suite exists for: the project's code length was 8, the input
   * was capped at 6, the entry was truncated before it was sent, and the member
   * who typed it correctly was told the code did not match. A setting change
   * reached the member as their own mistake. None of the assertions below may be
   * relaxed to make a copy change easier.
   */

  test("the accepted range is everything Supabase can issue, not one length", () => {
    expect(OTP_MIN_LENGTH).toBe(6);
    expect(OTP_MAX_LENGTH).toBe(10);
    expect(OTP_ACCEPTED_LENGTH).toEqual({ min: 6, max: 10 });
  });

  test("nothing is truncated: every length in the range is passed through whole", () => {
    for (let length = OTP_MIN_LENGTH; length <= OTP_MAX_LENGTH; length += 1) {
      const typed = "1234567890".slice(0, length);
      expect(normaliseCode(typed)).toHaveLength(length);
      expect(checkCode(typed)).toBeNull();
    }
  });

  test("an eight-digit code, the one that failed, reaches the provider intact", () => {
    expect(normaliseCode("12345678")).toBe("12345678");
    expect(checkCode("12345678")).toBeNull();
  });

  test("non-digits are dropped, and dropping them never shortens a real code", () => {
    expect(normaliseCode(" 123 456 ")).toBe("123456");
    expect(normaliseCode("12-34-56-78")).toBe("12345678");
  });

  test("an empty entry and a short one are different messages, and neither is a mismatch", () => {
    expect(checkCode("")).toBe("empty");
    expect(checkCode("   ")).toBe("empty");
    expect(checkCode("12345")).toBe("length");
    expect(checkCode("12345678901")).toBe("length");
  });

  test("a configured length is honoured only inside the range, and never gates entry", () => {
    expect(configuredOtpLength("8")).toBe(8);
    expect(configuredOtpLength(undefined)).toBeNull();
    expect(configuredOtpLength("")).toBeNull();
    expect(configuredOtpLength("four")).toBeNull();
    expect(configuredOtpLength("4")).toBeNull();
    expect(configuredOtpLength("12")).toBeNull();
    // Whatever the build was told, entry is still judged by the range: a stale
    // value cannot narrow what a member is allowed to type.
    expect(checkCode("1234567890")).toBeNull();
  });

  test("a setting outside the range is reported as a deployment problem", () => {
    expect(otpLengthOutOfRange("8")).toBe(false);
    expect(otpLengthOutOfRange(undefined)).toBe(false);
    expect(otpLengthOutOfRange("")).toBe(false);
    expect(otpLengthOutOfRange("4")).toBe(true);
    expect(otpLengthOutOfRange("12")).toBe(true);
    expect(otpLengthOutOfRange("six")).toBe(true);
  });

  test("no code copy claims a length, so a setting change cannot outdate it", () => {
    const step1 = en.join.step1 as Record<string, string>;
    const codeCopy = Object.entries(step1).filter(([key]) => key.startsWith("code"));
    expect(codeCopy.length).toBeGreaterThan(0);
    for (const [key, value] of codeCopy) {
      // codeLength is the one string that names digits, and it names the range
      // from the module rather than a number of its own.
      if (key === "codeLength") continue;
      expect(value).not.toMatch(/six|eight|\d+[- ]digit/i);
    }
    expect(step1['codeLength']).toContain("{min}");
    expect(step1['codeLength']).toContain("{max}");
  });

  test("the label asks for the code without describing its shape", () => {
    expect(en.join.step1.codeLabel).toBe("Enter the code from your email");
  });
});

describe("the challenge that stands in front of a member number", () => {
  /**
   * The gate this suite exists for: sequential member numbers during the
   * founding window are scriptable, and a challenge checked after
   * `reserve_member_number()` would let a bot burn the low range by failing it.
   * The assertions below are about placement, not about Cloudflare. They are
   * the cheapest thing that catches a refactor moving the check.
   */

  const membership = readSource("src/server/membership.ts");
  const turnstile = readSource("src/server/turnstile.server.ts");
  const widget = readSource("src/components/join/Challenge.tsx");

  test("reserve_member_number() has exactly one call site in the whole of src", () => {
    // The whole control rests on this. A second call site is a second door,
    // and it would not have the challenge in front of it.
    const callers = sourceFiles("src").filter((path) =>
      /rpc\(\s*["']reserve_member_number["']/.test(readSource(path)),
    );
    expect(callers).toEqual(["src/server/membership.ts"]);
    expect(membership.match(/rpc\(\s*["']reserve_member_number["']/g)).toHaveLength(1);
  });

  test("the challenge is verified before the number is reserved, in the same function", () => {
    const body = membership.slice(membership.indexOf("async function issueReservation"));
    const verified = body.indexOf("verifyChallenge");
    const reserved = body.indexOf("reserve_member_number");
    expect(verified).toBeGreaterThan(-1);
    expect(reserved).toBeGreaterThan(-1);
    expect(verified).toBeLessThan(reserved);
  });

  test("a refused challenge returns before anything is reserved", () => {
    expect(membership).toContain("if (!verdict.ok) return { issued: false, problem: verdict.problem }");
  });

  test("the stub is gated on a build-time constant, not only an environment variable", () => {
    // `import.meta.env.DEV` is replaced by `false` when Vite builds for
    // production, so the branch is absent from the bundle rather than merely
    // switched off. An env-only gate could be flipped on a live deployment.
    expect(turnstile).toContain("import.meta.env.DEV");
    expect(turnstile).toMatch(/const STUB_ALLOWED[^\n]*\n?[^\n]*import\.meta\.env\.DEV/);
    expect(widget).toContain("import.meta.env.DEV");
  });

  test("every path that is not an explicit success refuses", () => {
    // A missing secret, an unreachable Cloudflare, and an unparseable response
    // all fail closed. A challenge that cannot be checked has not been passed.
    expect(turnstile).toContain("if (!secret)");
    expect(turnstile).toContain('return { ok: false, problem: "unavailable" }');
    expect(turnstile).toContain("payload.success !== true");
  });

  test("the sentinel is refused outright by a build that does not honour it", () => {
    const guard = turnstile.indexOf("Stub token presented to a build that does not honour it");
    expect(guard).toBeGreaterThan(turnstile.indexOf("if (STUB_ALLOWED &&"));
  });

  test("the secret's value never reaches a log, a message, or the verdict", () => {
    // The variable name appears in a "this is not set" line, which is the
    // point of that line. What must never appear is the value it holds.
    expect(turnstile).not.toMatch(/\$\{\s*secret\s*\}/);
    expect(turnstile).not.toMatch(/console\.\w+\([^)]*\bsecret\b\s*[,)]/);
    // It leaves this module in exactly one direction: the POST body to
    // Cloudflare. Nothing in the returned verdict can carry it.
    expect(turnstile.match(/\bsecret\b(?!_KEY)/g)?.length).toBeGreaterThan(0);
    expect(turnstile).toContain("new URLSearchParams({ secret, response: supplied })");
  });

  test("failure copy exists for every problem the widget can report", () => {
    const challenge = en.join.challenge as Record<string, string>;
    for (const problem of ["unavailable", "failed", "expired"]) {
      expect(challenge[problem]).toBeTruthy();
    }
    expect(challenge["retry"]).toBeTruthy();
    expect(challenge["kept"]).toBeTruthy();
  });

  test("the copy says a number was not taken, and never blames the member", () => {
    const challenge = en.join.challenge as Record<string, string>;
    for (const problem of ["failed", "expired"]) {
      expect(challenge[problem]?.toLowerCase()).toContain("no number was taken");
    }
    const blame = /you failed|your fault|you did something|prove you|bot/i;
    for (const value of Object.values(challenge)) {
      expect(value).not.toMatch(blame);
    }
  });

  test("the copy keeps the house voice: no dashes as punctuation, no banned words", () => {
    const banned =
      /\b(unlock|empower|seamless|revolutionize|revolutionise|world-class|leverage|journey|elevate)\b/i;
    for (const value of Object.values(en.join.challenge as Record<string, string>)) {
      expect(value).not.toMatch(/[—–]/);
      expect(value).not.toMatch(banned);
    }
  });

  test("the stub notice names itself as a stub, so preview cannot be mistaken for live", () => {
    const stub = (en.join.challenge as Record<string, string>)["stub"] ?? "";
    expect(stub.toLowerCase()).toContain("stubbed");
    expect(stub.toLowerCase()).toContain("production");
  });
});

describe("the address, checked while it is being chosen", () => {
  /**
   * Why this suite exists: before it, there was no availability check in the
   * join flow at all. `taken` was in the union type and had copy against it,
   * and `setHandleProblem("taken")` was never called from anywhere. A member
   * found out their address was gone at /verify, after completing every step.
   *
   * Collision is expected to be the highest-volume case at launch, not an edge
   * case: African and diaspora naming means many members want the same first
   * name. So most of what is asserted below is about tone and placement, which
   * is where that requirement actually lives.
   */

  const hook = readSource("src/components/join/useHandleAvailability.ts");
  const compact = readSource("src/components/join/steps/StepCompact.tsx");
  const membership = readSource("src/lib/member/membership.ts");
  const join = readSource("src/routes/$locale/join/register.tsx");
  const verify = readSource("src/routes/$locale/verify.tsx");

  test("what the register said becomes what the member is told", () => {
    expect(readHandleAvailability(true, false)).toBe("available");
    // Reserved and taken are different things and must read differently.
    expect(readHandleAvailability(false, true)).toBe("reserved");
    expect(readHandleAvailability(false, false)).toBe("taken");
  });

  test("a check that could not run is not a problem the member is shown", () => {
    // Nothing on this screen commits the address. A failed check must never be
    // the reason a member cannot proceed.
    expect(readHandleAvailability(null, false)).toBe("unknown");
    expect(readHandleAvailability(null, true)).toBe("unknown");
  });

  test("only an address that could be claimed is worth a request", () => {
    expect(worthCheckingHandle("ama-mensah")).toBe(true);
    expect(worthCheckingHandle("  ama  ")).toBe(true);
    // Every one of these is answered on the device, for free.
    expect(worthCheckingHandle("")).toBe(false);
    expect(worthCheckingHandle("ab")).toBe(false);
    expect(worthCheckingHandle("-ama")).toBe(false);
    expect(worthCheckingHandle("Ama")).toBe(false);
    expect(worthCheckingHandle("a".repeat(31))).toBe(false);
  });

  test("format is settled before the register is asked, not after", () => {
    // The ordering is the whole point: a malformed address costs no request.
    // Matched on the guard statement, not on the identifier: the identifier
    // also appears in the import line at the top of the file, which would sit
    // before the request no matter what the body actually did.
    const guard = hook.indexOf("if (!worthCheckingHandle(candidate)) {");
    const request = hook.indexOf("isHandleAvailable(candidate)");
    expect(guard).toBeGreaterThan(-1);
    expect(request).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(request);
    // And the guard returns, rather than merely noting the problem and
    // carrying on into the request.
    expect(hook.slice(guard, request)).toContain("return;");
  });

  test("the check is debounced, so it is not one request per keystroke", () => {
    expect(hook).toContain("HANDLE_CHECK_DEBOUNCE_MS");
    expect(hook).toMatch(/setTimeout\(/);
    expect(hook).toContain("}, HANDLE_CHECK_DEBOUNCE_MS);");
    // Cleared on the way out, or a member typing fast queues a request per keystroke
    // after all.
    expect(hook).toContain("clearTimeout(timer)");
    expect(HANDLE_CHECK_DEBOUNCE_MS).toBeGreaterThan(0);
    expect(HANDLE_CHECK_DEBOUNCE_MS).toBeLessThanOrEqual(1000);
  });

  test("an answer that arrives late cannot overwrite a newer one", () => {
    // Members on unreliable connections get responses out of order. Without
    // this, a slow "taken" lands against an address they have since changed.
    expect(hook).toContain("const ticket = ++latest.current");
    expect(hook.match(/if \(ticket !== latest\.current\) return;/g)?.length).toBeGreaterThanOrEqual(
      2,
    );
  });

  test("nothing is asked until the member is on the screen with an address on it", () => {
    expect(hook).toContain("if (!enabled) return;");
    expect(join).toContain("enabled: step === 4");
  });

  test("it fires the existing 'taken' state rather than inventing a new one", () => {
    // `handleProblem` already carried "taken" and "reserved" and already had
    // copy against both. The check feeds that, so there is one path to the
    // message and one place it is rendered.
    expect(join).toContain("onResult: setHandleProblem");
    expect(hook).toContain('onResult(outcome)');
    expect(hook).toContain('readHandleAvailability(available, reserved)');
  });

  test("suggestions are asked for with the member's own name and what they typed", () => {
    expect(hook).toContain("fetchHandleSuggestions(firstName, lastName, candidate)");
    // Alongside the reason, not after it: the member sees the problem and the
    // way out together.
    expect(hook).toContain("await Promise.all([");
  });

  test("between three and five suggestions, which is a choice and not a list", () => {
    expect(HANDLE_SUGGESTIONS_WANTED).toBeGreaterThanOrEqual(3);
    expect(HANDLE_SUGGESTIONS_WANTED).toBeLessThanOrEqual(5);
  });

  test("a failed availability check returns null and never blocks", () => {
    const body = membership.slice(membership.indexOf("export async function isHandleAvailable"));
    expect(body).toContain("if (error) return null;");
    // And an empty suggestion list is a normal answer, not a thrown error.
    const suggestions = membership.slice(
      membership.indexOf("export async function fetchHandleSuggestions"),
    );
    expect(suggestions).toContain("if (error || !data) return [];");
  });

  test("a taken address is not rendered as an error", () => {
    // The requirement this suite exists for. Collision is the commonest thing
    // that happens on this screen, so it must read as a normal step in choosing
    // a name: no red, no alarm.
    expect(compact).toContain(
      'const unavailable = handleProblem === "taken" || handleProblem === "reserved";',
    );
    expect(compact).toContain("const formatProblem = unavailable ? null : handleProblem;");

    const region = compact.slice(
      compact.indexOf('id="r17-handle-note"'),
      compact.indexOf("{!formatProblem && !unavailable"),
    );
    expect(region.length).toBeGreaterThan(0);
    // `r17-error` is the red one, and `alert` interrupts a screen reader.
    expect(region).not.toContain("r17-error");
    expect(region).not.toContain('role="alert"');
    expect(region).toContain('role="status"');
    // The taken and reserved copy is rendered here, in the calm region.
    expect(region).toContain("join.handleErrors.${handleProblem}");
  });

  test("the field is not marked invalid for an address someone else simply has", () => {
    // aria-invalid on a taken address tells a screen reader the member did
    // something wrong. They did not.
    expect(compact).toContain("aria-invalid={formatProblem ? true : undefined}");
  });

  test("suggestions are clickable, and clicking one fills the field", () => {
    expect(compact).toContain("onClick={() => onPickHandle(suggestion)}");
    expect(join).toContain("onPickHandle={(handle) => update({ handle })}");
    // r17-chip carries min-height: var(--join-tap-min), which is the 48px rule.
    expect(compact).toContain('className="r17-chip"');
  });

  test("the handle_taken path at /verify is kept as the last line of defence", () => {
    // The address is committed at /verify, not at /join, so it can still be
    // taken in between. The check on the join screen makes that race rare; it
    // does not remove it, and removing this would be the actual regression.
    expect(verify).toContain('case "handle_taken":');
    expect(verify).toContain('setProblem("taken")');
    expect(verify).toContain('case "handle_reserved":');
  });

  test("every new string is in en.json, and none is hardcoded in the screen", () => {
    const step4 = en.join.step4 as Record<string, string>;
    for (const key of [
      "handleChecking",
      "handleFree",
      "handleSuggestionsLabel",
      "handleSuggestionTake",
    ]) {
      expect(step4[key]).toBeTruthy();
      expect(compact).toContain(`join.step4.${key}`);
    }
    // The one string that takes the address itself keeps its placeholder.
    expect(step4["handleSuggestionTake"]).toContain("{handle}");
  });

  test("the reason reads differently for reserved than for taken", () => {
    const errors = en.join.handleErrors as Record<string, string>;
    expect(errors["taken"]).toBeTruthy();
    expect(errors["reserved"]).toBeTruthy();
    expect(errors["taken"]).not.toBe(errors["reserved"]);
  });

  test("the copy keeps the house voice and never blames the member", () => {
    const banned =
      /\b(unlock|empower|seamless|revolutionize|revolutionise|world-class|leverage|journey|elevate)\b/i;
    const blame = /you failed|your fault|not allowed|invalid|error|sorry/i;
    const step4 = en.join.step4 as Record<string, string>;
    const strings = [
      step4["handleChecking"],
      step4["handleFree"],
      step4["handleSuggestionsLabel"],
      step4["handleSuggestionTake"],
      ...Object.values(en.join.handleErrors as Record<string, string>),
    ];
    for (const value of strings) {
      expect(value).not.toMatch(/[—–]/);
      expect(value).not.toMatch(banned);
      expect(value).not.toMatch(blame);
    }
  });
});
