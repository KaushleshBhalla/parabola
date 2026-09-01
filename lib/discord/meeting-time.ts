import "server-only";

// Friendly names -> IANA zones. Not exhaustive — covers what people actually
// type. Unrecognized input falls through to being tried as an IANA zone
// directly (e.g. "Asia/Kolkata"), so power users aren't blocked by this list.
const TIMEZONE_ALIASES: Record<string, string> = {
  indian: "Asia/Kolkata",
  india: "Asia/Kolkata",
  ist: "Asia/Kolkata",
  utc: "UTC",
  gmt: "UTC",
  est: "America/New_York",
  edt: "America/New_York",
  eastern: "America/New_York",
  cst: "America/Chicago",
  cdt: "America/Chicago",
  central: "America/Chicago",
  mst: "America/Denver",
  mdt: "America/Denver",
  mountain: "America/Denver",
  pst: "America/Los_Angeles",
  pdt: "America/Los_Angeles",
  pacific: "America/Los_Angeles",
  bst: "Europe/London",
  gmt1: "Europe/London",
  uk: "Europe/London",
  british: "Europe/London",
  london: "Europe/London",
  cet: "Europe/Paris",
  "central european": "Europe/Paris",
  jst: "Asia/Tokyo",
  japan: "Asia/Tokyo",
  sgt: "Asia/Singapore",
  singapore: "Asia/Singapore",
  aest: "Australia/Sydney",
  sydney: "Australia/Sydney",
  australian: "Australia/Sydney",
};

function resolveTimezone(input: string): string | null {
  const key = input.trim().toLowerCase();
  if (TIMEZONE_ALIASES[key]) return TIMEZONE_ALIASES[key];
  // Try it as a literal IANA zone (e.g. "Asia/Kolkata") — Intl throws on bad input.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: input.trim() });
    return input.trim();
  } catch {
    return null;
  }
}

/**
 * Converts a wall-clock time in a given IANA zone to the matching UTC
 * instant, without a timezone library — Intl already knows every zone's
 * offset (DST included) for any date, so this just asks it what offset
 * applies near our guess and corrects for it. Converges in 1-2 passes.
 */
function zonedWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const target = guess;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(dtf.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    const asIfUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) === 24 ? 0 : Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const diff = target - asIfUtc;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

const TIME_RE = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(today|tomorrow)?$/i;

/**
 * Parses /setmeet's `time` + `timezone` options — e.g. "10pm today" +
 * "Indian" — into an absolute UTC Date. Deliberately narrow: a 12/24-hour
 * clock time, optionally with "today"/"tomorrow" (defaults to today, rolling
 * to tomorrow automatically if that time has already passed today), plus a
 * timezone name or IANA zone. Not a general date parser.
 */
export function parseMeetingTime(timeInput: string, timezoneInput: string): { utc: Date } | { error: string } {
  const timeZone = resolveTimezone(timezoneInput);
  if (!timeZone) {
    return { error: `Didn't recognize timezone "${timezoneInput}" — try Indian, UTC, Eastern, Pacific, or an IANA zone like Asia/Kolkata.` };
  }

  const match = timeInput.trim().match(TIME_RE);
  if (!match) {
    return { error: `Didn't understand "${timeInput}" as a time — try e.g. "10pm today", "10:30pm tomorrow", or "22:00".` };
  }

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3]?.toLowerCase();
  const dayWord = match[4]?.toLowerCase();

  if (meridiem) {
    if (hour < 1 || hour > 12) return { error: `"${timeInput}" isn't a valid 12-hour time.` };
    if (meridiem === "am") hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
  } else if (hour > 23 || minute > 59) {
    return { error: `"${timeInput}" isn't a valid time.` };
  }

  // "Today" in the meeting's own timezone, not the server's.
  const nowParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  let year = Number(nowParts.year);
  let month = Number(nowParts.month);
  let day = Number(nowParts.day);

  if (dayWord === "tomorrow") {
    const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
    year = tomorrow.getUTCFullYear();
    month = tomorrow.getUTCMonth() + 1;
    day = tomorrow.getUTCDate();
  }

  let utc = zonedWallTimeToUtc(year, month, day, hour, minute, timeZone);

  // No explicit day given and the time's already passed today — assume they
  // mean the next occurrence, tomorrow, rather than erroring.
  if (!dayWord && utc.getTime() <= Date.now()) {
    const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
    utc = zonedWallTimeToUtc(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), hour, minute, timeZone);
  }

  if (utc.getTime() <= Date.now()) {
    return { error: "That time is in the past." };
  }

  return { utc };
}
