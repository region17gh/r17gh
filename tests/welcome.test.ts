/**
 * The welcome email, run with `bun test`.
 *
 * Outside `src/` for the same reason as join.test.ts: Bun's global types break
 * the generated Supabase files if they enter the app's TypeScript program.
 */
import { describe, expect, test } from "bun:test";

import { MORNING_HOUR, MORNING_WINDOW, nextLocalMorning } from "../src/lib/email/schedule";
import { buildWelcomeEmail } from "../src/lib/email/welcome";
import en from "../src/i18n/locales/en.json";

/** What a clock in `zone` reads at `iso`. The tests assert against this, not offsets. */
function wallTime(iso: string, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { month: read("month"), day: read("day"), hour: read("hour") % 24, minute: read("minute") };
}

const FOUNDER = {
  firstName: "Ama",
  memberNumber: 1,
  credentialId: "R17-26-000001-C",
  foundingMember: true,
  classYear: 2026,
  foundingCutoff: new Date("2026-12-31T23:59:59Z"),
};

const OPTIONS = { locale: "en" as const, siteUrl: "https://r17gh.com" };

describe("the member's local morning", () => {
  /**
   * The rule this suite exists for: members are spread across every time zone
   * there is. A register that mails everyone the moment they activate reaches a
   * large share of them in the middle of the night.
   */

  test("a member with no time zone is sent to now", () => {
    const now = new Date("2026-08-25T23:00:00Z");
    expect(nextLocalMorning(now, null)).toBeNull();
    expect(nextLocalMorning(now, "")).toBeNull();
    expect(nextLocalMorning(now, "   ")).toBeNull();
  });

  test("a time zone the runtime does not know is sent to now, not thrown", () => {
    // Registration takes this from the browser, so a stale or fabricated value
    // arrives intact. It must not become an exception on the activation path.
    expect(nextLocalMorning(new Date("2026-08-25T23:00:00Z"), "Mars/Olympus_Mons")).toBeNull();
    expect(nextLocalMorning(new Date("2026-08-25T23:00:00Z"), "not a zone")).toBeNull();
  });

  test("a member already inside their morning is sent to now", () => {
    // 09:00 in Accra. They are holding the screen that just told them they are in.
    expect(nextLocalMorning(new Date("2026-08-25T09:00:00Z"), "Africa/Accra")).toBeNull();
    expect(nextLocalMorning(new Date("2026-08-25T06:00:00Z"), "Africa/Accra")).toBeNull();
    // 11:59, the last minute of the window.
    expect(nextLocalMorning(new Date("2026-08-25T11:59:00Z"), "Africa/Accra")).toBeNull();
  });

  test("a member outside the window lands at the morning hour, in their own zone", () => {
    const zones = [
      "Africa/Accra",
      "America/New_York",
      "America/Los_Angeles",
      "Europe/London",
      "Asia/Kolkata",
      "Asia/Kathmandu",
      "Australia/Sydney",
      "Pacific/Auckland",
    ];
    // Every hour of a day, so no zone gets a lucky single sample.
    for (const zone of zones) {
      for (let hour = 0; hour < 24; hour += 1) {
        const now = new Date(`2026-08-25T${String(hour).padStart(2, "0")}:30:00Z`);
        const scheduled = nextLocalMorning(now, zone);
        if (scheduled === null) {
          // The only reason to send now is that they are already in the window.
          const local = wallTime(now.toISOString(), zone);
          expect(local.hour).toBeGreaterThanOrEqual(MORNING_WINDOW.from);
          expect(local.hour).toBeLessThan(MORNING_WINDOW.until);
          continue;
        }
        const landing = wallTime(scheduled, zone);
        expect(landing.hour).toBe(MORNING_HOUR);
        expect(landing.minute).toBe(0);
        expect(new Date(scheduled).getTime()).toBeGreaterThan(now.getTime());
      }
    }
  });

  test("a forty-five minute zone is handled, not rounded to the nearest hour", () => {
    // Kathmandu is UTC+05:45. A solver that only corrects whole hours lands
    // this at 08:45 or 07:15 and the test would catch it.
    const scheduled = nextLocalMorning(new Date("2026-08-25T20:00:00Z"), "Asia/Kathmandu");
    expect(scheduled).not.toBeNull();
    expect(wallTime(scheduled as string, "Asia/Kathmandu")).toMatchObject({ hour: 8, minute: 0 });
  });

  test("it holds across a daylight saving change", () => {
    // The US spring forward, 2027-03-14. An activation the evening before must
    // still land at 08:00 local on the morning the clocks moved.
    const scheduled = nextLocalMorning(new Date("2027-03-14T02:00:00Z"), "America/New_York");
    expect(scheduled).not.toBeNull();
    expect(wallTime(scheduled as string, "America/New_York")).toMatchObject({ hour: 8, minute: 0 });
  });

  test("never schedules into the past", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const now = new Date(`2026-11-01T${String(hour).padStart(2, "0")}:15:00Z`);
      const scheduled = nextLocalMorning(now, "America/Los_Angeles");
      if (scheduled) expect(new Date(scheduled).getTime()).toBeGreaterThan(now.getTime());
    }
  });
});

describe("the welcome email", () => {
  const founding = buildWelcomeEmail(FOUNDER, OPTIONS);

  test("carries the disclaimer verbatim, in both parts", () => {
    // A safety control, not copy. If this fails, do not reword the assertion.
    const disclaimer = en.legal.notAGovernmentDocument;
    expect(disclaimer).toBe(
      "Region 17 membership is a standing in a community. It is not a government document and confers no citizenship, residence, visa, or right of entry.",
    );
    expect(founding.text).toContain(disclaimer);
    expect(founding.html).toContain(disclaimer);
  });

  test("renders the credential as text, never as an image", () => {
    expect(founding.html).not.toContain("<img");
    expect(founding.html).toContain("R17-26-000001-C");
    expect(founding.html).toContain("000001");
    expect(founding.text).toContain("R17-26-000001-C");
    expect(founding.text).toContain("000001");
  });

  test("loads nothing from anywhere: no image, no remote asset, no tracker", () => {
    // Members are frequently on metered connections, and every remote asset is
    // also a surface that fails when a client blocks it.
    const hosts = [...founding.html.matchAll(/https?:\/\/([a-z0-9.\-]+)/gi)].map((m) => m[1]);
    expect([...new Set(hosts)]).toEqual(["r17gh.com"]);
    expect(founding.html).not.toMatch(/<(img|script|iframe|link|video)\b/i);
    expect(founding.html).not.toMatch(/background-image|url\(/i);
  });

  test("names the founding close as the register holds it", () => {
    expect(founding.text).toContain("31 December 2026");
    expect(founding.html).toContain("31 December 2026");
    expect(founding.text).toContain("Founding Member");
  });

  test("offers exactly one action", () => {
    const links = [...founding.html.matchAll(/<a\b[^>]*href=/gi)];
    expect(links).toHaveLength(1);
    expect(founding.html).toContain("https://r17gh.com/en/home");
  });

  test("a member who joined after the window is told nothing about founding standing", () => {
    const later = buildWelcomeEmail(
      { ...FOUNDER, foundingMember: false, classYear: 2027, foundingCutoff: null },
      OPTIONS,
    );
    expect(later.text).not.toContain("Founding Member");
    expect(later.html).not.toContain("Founding Member");
    expect(later.text).not.toContain("31 December 2026");
    // The rest of the credential still arrives.
    expect(later.text).toContain("R17-26-000001-C");
  });

  test("a member with no first name is greeted without a blank", () => {
    const anon = buildWelcomeEmail({ ...FOUNDER, firstName: null }, OPTIONS);
    expect(anon.text).toContain("Welcome, member.");
    expect(anon.text).not.toContain("Welcome, .");
    expect(buildWelcomeEmail({ ...FOUNDER, firstName: "   " }, OPTIONS).text).toContain(
      "Welcome, member.",
    );
  });

  test("a name is escaped, because a member chose it and it reaches HTML", () => {
    const hostile = buildWelcomeEmail(
      { ...FOUNDER, firstName: '<script>alert("x")</script>' },
      OPTIONS,
    );
    expect(hostile.html).not.toContain("<script>");
    expect(hostile.html).toContain("&lt;script&gt;");
  });

  test("the plain-text part is a real alternative, not a stub", () => {
    // It is what a text-only client shows and what a screen reader reads.
    expect(founding.text).not.toContain("<");
    for (const line of ["Member number: 000001", "Credential ID: R17-26-000001-C"]) {
      expect(founding.text).toContain(line);
    }
    expect(founding.text.length).toBeGreaterThan(600);
  });

  test("declares a colour scheme and a designed dark rendering", () => {
    // The common dark-mode failure is partial inversion, not absent styling.
    expect(founding.html).toContain('name="color-scheme"');
    expect(founding.html).toContain("prefers-color-scheme: dark");
    expect(founding.html).toContain("[data-ogsc]"); // Outlook.com drops the media query
    // Neither of the two values inverting clients treat most aggressively.
    expect(founding.html).not.toMatch(/#(fff|ffffff|000|000000)\b/i);
  });

  test("every element that holds text declares its own colour", () => {
    const body = founding.html.slice(founding.html.indexOf("<body"));
    const bare = [...body.matchAll(/<(?:p|h1|span|a)\b[^>]*>/gi)]
      .map((m) => m[0])
      .filter((tag) => !tag.includes("display:none"))
      .filter((tag) => !/(?<!background-)color\s*:/.test(tag));
    expect(bare).toEqual([]);
  });

  test("the subject names the member's number and the copy keeps the house voice", () => {
    expect(founding.subject).toBe("Welcome to Region 17. You are member 000001.");
    const banned =
      /\b(unlock|empower|seamless|revolutionize|revolutionise|world-class|leverage|journey|elevate)\b/i;
    for (const value of Object.values(en.email.welcome as Record<string, string>)) {
      expect(value).not.toMatch(banned);
      expect(value).not.toMatch(/[—–]/);
    }
  });

  test("promises nothing Region 17 does not control, and claims no legal standing", () => {
    const forbidden = /\b(visa|citizenship|residency|work permit|guarantee|job placement)\b/i;
    for (const [key, value] of Object.entries(en.email.welcome as Record<string, string>)) {
      expect(`${key}: ${value}`).not.toMatch(forbidden);
    }
    // The disclaimer is the one place those words appear, and it denies them.
    expect(founding.text).toContain("confers no citizenship");
  });
});
