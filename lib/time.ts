export const TZ = "America/Chicago";

/** Parts of a date as seen on a Chicago wall clock. */
export function chicagoParts(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, weekday: p.weekday };
}

/** YYYY-MM-DD for "today" in Chicago. */
export function chicagoToday(d = new Date()) {
  const p = chicagoParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso: string | Date | null | undefined) {
  if (!iso) return "";
  const s = typeof iso === "string" ? iso.slice(0, 10) : toIso(iso);
  const d = new Date(s + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function fmtMoney(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Date column values come back as JS Dates at UTC midnight; turn them back into YYYY-MM-DD. */
export function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** Which scheduled slot (if any) matches this moment in Chicago. */
export function currentSlot(d = new Date()): "6am" | "11am" | "3pm" | null {
  const { hour } = chicagoParts(d);
  if (hour === 6) return "6am";
  if (hour === 11) return "11am";
  if (hour === 15) return "3pm";
  return null;
}

/** "2026-11-14T18:30" typed on Cody's phone means Chicago time, whatever the server's zone is. */
export function chicagoLocalToDate(s: string) {
  const guess = new Date(s.length === 16 ? s + ":00Z" : s + "Z");
  const p = chicagoParts(guess);
  const seenAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return new Date(guess.getTime() - (seenAsUtc - guess.getTime()));
}
