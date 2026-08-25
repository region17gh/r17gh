/**
 * When a member's welcome email should land.
 *
 * The rule is: their local morning, where we know what their local is. Members
 * are spread across every time zone there is, and a register that mails
 * everybody at once reaches half of them in the middle of the night. The time
 * zone is captured at registration from the browser, so for most members we
 * know it. For the rest we send immediately, because a message that arrives now
 * beats a message held back on a guess.
 *
 * Pure, and no dependency on a date library: the intl data is already in every
 * runtime this ships to. Everything here takes `now` as an argument so the
 * tests can pin it.
 */

/** The hour a scheduled email is aimed at, in the member's own zone. */
export const MORNING_HOUR = 8;

/**
 * The window that counts as already-morning. A member who activates at ten in
 * the morning should not wait twenty-two hours for a greeting: they are holding
 * the screen that told them to expect it.
 */
export const MORNING_WINDOW = { from: 6, until: 12 } as const;

/** A wall clock reading in some zone. */
interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * When to send, as an ISO 8601 instant, or null for "send now".
 *
 * Null is returned for an unknown or unusable zone and for a member who is
 * already inside their morning. Null is not a failure and the caller does not
 * need to treat it as one: it is the ordinary answer for roughly a quarter of
 * members.
 */
export function nextLocalMorning(now: Date, timezone: string | null | undefined): string | null {
  const zone = (timezone ?? "").trim();
  if (!zone) return null;

  let local: WallTime;
  try {
    local = wallTimeIn(now, zone);
  } catch {
    // A zone name the runtime does not know. Registration takes this from the
    // browser, so a stale or fabricated value reaches us intact. Send now
    // rather than schedule against a clock we cannot read.
    return null;
  }

  if (local.hour >= MORNING_WINDOW.from && local.hour < MORNING_WINDOW.until) return null;

  // Before the window: this morning. After it: tomorrow morning.
  const target = { ...local, hour: MORNING_HOUR, minute: 0, second: 0 };
  if (local.hour >= MORNING_WINDOW.until) {
    const tomorrow = addDays(local.year, local.month, local.day, 1);
    target.year = tomorrow.year;
    target.month = tomorrow.month;
    target.day = tomorrow.day;
  }

  const instant = wallTimeToInstant(target, zone);
  if (instant === null) return null;

  // A zone whose offset moved between the reading and the target can land the
  // answer marginally behind now. Sending now is the right answer then.
  if (instant.getTime() <= now.getTime()) return null;
  return instant.toISOString();
}

/** What a clock in `zone` reads at `instant`. Throws on a zone Intl rejects. */
function wallTimeIn(instant: Date, zone: string): WallTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`Unreadable ${type} for zone ${zone}.`);
    return parsed;
  };

  // Intl renders midnight as hour 24 in some runtimes. Normalise it to 0 so the
  // window comparison above cannot silently miss it.
  const hour = read("hour") % 24;
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour,
    minute: read("minute"),
    second: read("second"),
  };
}

/**
 * The UTC instant at which a clock in `zone` reads `target`.
 *
 * Solved rather than looked up: guess that the wall time is UTC, ask what that
 * guess actually reads as in the zone, and correct by the difference. One
 * correction is enough for a whole-hour offset; the second pass catches the
 * half-hour and three-quarter-hour zones and the days a DST change moves the
 * offset between the guess and the answer. Returns null if it will not settle,
 * which sends the email now instead of at a time nobody can account for.
 */
function wallTimeToInstant(target: WallTime, zone: string): Date | null {
  const wanted = Date.UTC(target.year, target.month - 1, target.day, target.hour, 0, 0);
  let guess = wanted;

  for (let pass = 0; pass < 3; pass += 1) {
    const reading = wallTimeIn(new Date(guess), zone);
    const readAs = Date.UTC(
      reading.year,
      reading.month - 1,
      reading.day,
      reading.hour,
      reading.minute,
      reading.second,
    );
    const drift = wanted - readAs;
    if (drift === 0) return new Date(guess);
    guess += drift;
  }

  // A wall time that does not exist, which is what a spring-forward gap is:
  // 08:00 is skipped outright in a zone that jumps 01:00 to 02:00 only if the
  // jump covers it. Rare, and not worth a special case beyond sending now.
  return null;
}

/** Calendar arithmetic on a wall date, in UTC so no zone is involved. */
function addDays(year: number, month: number, day: number, days: number) {
  const moved = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
  };
}
