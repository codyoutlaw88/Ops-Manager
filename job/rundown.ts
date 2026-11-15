import type postgres from "postgres";
import type { Fresh } from "./apply";
import { addDays, fmtDate, fmtMoney, toIso } from "../lib/time";

type Sql = ReturnType<typeof postgres>;

export type Rundown = { needs_today: string[]; coming_up: string[]; fyi: string[]; failed: boolean; text: string };

const COMING_UP_DAYS = 14; // trips and birthdays show up this many days ahead
const MONEY_KINDS = new Set(["bill", "shutoff", "settlement"]);

type OpenRow = { id: number; kind: string; title: string; amount: number | null; due_date: Date | null };

export function openItemLine(o: OpenRow, today: string) {
  const due = toIso(o.due_date);
  let when = "";
  const word = o.kind === "package" ? "arriving" : ["appointment", "trip", "birthday"].includes(o.kind) ? "on" : "due";
  if (due && word !== "due") when = due === today ? `, ${word === "on" ? "" : word + " "}today` : `, ${word} ${fmtDate(due)}`;
  else if (due) when = due < today ? `, was due ${fmtDate(due)} (late)` : due === today ? ", due today" : `, due ${fmtDate(due)}`;
  const amt = o.amount != null ? ` ${fmtMoney(o.amount)}` : "";
  const unconfirmed = MONEY_KINDS.has(o.kind) ? " (unconfirmed)" : "";
  return `${o.title}${amt}${when}${unconfirmed}`;
}

/** Builds the three sections: fresh mail from this run plus every open item that isn't done. */
export async function buildRundown(sql: Sql, today: string, fresh: Fresh[], failure: string | null, slotLabel: string): Promise<Rundown> {
  const open = (await sql`
    select id, kind, title, amount, due_date from open_items where status = 'open'
    order by due_date nulls last, id`) as unknown as OpenRow[];
  const horizon = addDays(today, COMING_UP_DAYS);

  const needs: string[] = [];
  const coming: string[] = [];
  const fyi: string[] = [];

  for (const o of open) {
    const due = toIso(o.due_date);
    const line = openItemLine(o, today);
    // Every open item is carried until Cody marks it done.
    if (due && due <= today) needs.push(line);
    else if (!due && fresh.some((f) => f.openItemId === o.id && f.urgency === "today")) needs.push(line);
    else coming.push(line);
  }

  const trips = (await sql`
    select kind, title, start_date, people from trips_events
    where start_date between ${today}::date and ${horizon}::date order by start_date`) as unknown as { kind: string; title: string; start_date: Date; people: string | null }[];
  for (const t of trips) {
    const d = toIso(t.start_date)!;
    const line = `${t.title}, ${d === today ? "today" : fmtDate(d)}${t.people && t.kind === "trip" ? ` (${t.people})` : ""}`;
    (d === today ? needs : coming).push(line);
  }

  for (const f of fresh) {
    if (f.openItemId) continue; // already shown through its open item
    if (f.urgency === "today") needs.push(f.line);
    else if (f.urgency === "upcoming") coming.push(f.line);
    else fyi.push(f.line);
  }

  const section = (name: string, lines: string[]) => `${name}\n${lines.length ? lines.map((l) => `• ${l}`).join("\n") : "• Nothing"}`;
  const header = failure
    ? `${slotLabel} rundown: COULDN'T READ YOUR INBOX.\nReason: ${failure}\nNothing below comes from new mail. These are open items already on your list.\n\n`
    : "";
  const text = header + [section("Needs you today", needs), section("Coming up", coming), section("FYI", fyi)].join("\n\n");
  return { needs_today: needs, coming_up: coming, fyi, failed: !!failure, text };
}
