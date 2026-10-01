// All times are stored as UTC ISO strings and shown in Vancouver local time,
// regardless of where the server runs.

export const TIME_ZONE = "America/Vancouver";

function offsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}

/** "2026-10-02T10:30" typed into a datetime-local field → UTC ISO string. */
export function localInputToIso(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid date/time: ${value}`);
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes handle the hour around DST changes.
  let utc = guess - offsetMs(guess);
  utc = guess - offsetMs(utc);
  return new Date(utc).toISOString();
}

/** UTC ISO string → value for a datetime-local field. */
export function isoToLocalInput(iso: string): string {
  const ms = new Date(iso).getTime();
  return new Date(ms + offsetMs(ms)).toISOString().slice(0, 16);
}

/** Default for a new request: two hours from now, on the hour. */
export function defaultPickupInput(now: Date = new Date()): string {
  const d = new Date(now.getTime() + 2 * 3600e3);
  d.setUTCMinutes(0, 0, 0);
  return isoToLocalInput(d.toISOString());
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function formatDay(iso: string, now: Date = new Date()): string {
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d);
  const target = day(new Date(iso));
  if (target === day(now)) return "Today";
  if (target === day(new Date(now.getTime() + 864e5))) return "Tomorrow";
  if (target === day(new Date(now.getTime() - 864e5))) return "Yesterday";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, weekday: "short", month: "short", day: "numeric" }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso: string, now?: Date): string {
  return `${formatDay(iso, now)}, ${formatTime(iso)}`;
}

/** Unambiguous for texts and emails read later, e.g. "Thu, Oct 2, 9:45 a.m." */
export function formatShort(iso: string): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
  return `${date}, ${formatTime(iso)}`;
}

/** Long form for the printed ride slip, e.g. "Thursday, October 2 at 9:45 a.m." */
export function formatLong(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, weekday: "long", month: "long", day: "numeric" }).format(d);
  return `${date} at ${formatTime(iso)}`;
}

export function formatMoney(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}
