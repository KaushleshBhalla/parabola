import "server-only";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RELATIVE_RE = /^(\d+)\s*(d|days?|h|hrs?|hours?|w|wks?|weeks?)$/i;

/**
 * Parses /assign's `deadline` option: an absolute YYYY-MM-DD date, or Discord-
 * friendly shorthand like "2d" (2 days) or "5hr" (5 hours). workItems.dueDate
 * is a date-only column (no time-of-day), so anything under 24h rounds to
 * whatever calendar date that many hours from now lands on — "2hr" and "20hr"
 * both usually mean "today". That's a real limitation of the column, not a
 * bug here; flagged in the /assign reply so it's never a silent surprise.
 */
export function parseDeadlineInput(input: string): { date: string; rounded: boolean } | { error: string } {
  const trimmed = input.trim();

  if (ISO_DATE_RE.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return { error: `"${input}" isn't a valid date.` };
    return { date: trimmed, rounded: false };
  }

  const match = trimmed.match(RELATIVE_RE);
  if (!match) {
    return { error: `Couldn't understand "${input}" as a deadline — try e.g. \`2d\`, \`5hr\`, \`1w\`, or \`YYYY-MM-DD\`.` };
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2][0].toLowerCase();
  const msPerUnit = unit === "w" ? 7 * 86_400_000 : unit === "d" ? 86_400_000 : 3_600_000;
  const due = new Date(Date.now() + amount * msPerUnit);
  return { date: due.toISOString().slice(0, 10), rounded: unit === "h" };
}
