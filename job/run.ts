/** One rundown run: read new mail, update trackers, write and send the rundown. See job/cli.ts for the scheduled entry point. */
import { db } from "../lib/db";
import { chicagoToday } from "../lib/time";
import { sendPush, sendPushover } from "../lib/push";
import { fetchNewMail, type Cursor, type MailMessage } from "./mail";
import { skipReason, type Filter } from "./filters";
import { extract, type Extracted } from "./extract";
import { applyMessage, type Fresh } from "./apply";
import { buildRundown } from "./rundown";

const SLOT_LABEL: Record<string, string> = { "6am": "6 AM", "11am": "11 AM", "3pm": "3 PM", manual: "On-demand" };

export async function runOnce(opts: { slot: string; now?: Date }) {
  const sql = db();
  const now = opts.now ?? new Date();
  const today = chicagoToday(now);

  // Don't double-run a slot (GitHub may fire both the CST and CDT schedules, or retry).
  if (opts.slot !== "manual") {
    const dup = await sql`select 1 from runs where slot = ${opts.slot} and status = 'ok'
      and (started_at at time zone 'America/Chicago')::date = ${today}::date limit 1`;
    if (dup.length) { console.log(`${opts.slot} already ran today; skipping.`); return null; }
  }

  const [prev] = await sql`select finished_at from runs where status = 'ok' order by finished_at desc limit 1`;
  const [run] = await sql`insert into runs (slot, started_at, window_start) values (${opts.slot}, ${now}, ${prev?.finished_at ?? null}) returning id`;
  const runId = run.id as number;

  let failure: string | null = null;
  const fresh: Fresh[] = [];
  let read = 0, skipped = 0, extracted = 0;

  try {
    const [c] = await sql`select value from settings where key = 'imap_cursor'`;
    const cursor = (c?.value as Cursor | undefined) ?? null;
    const filters = (await sql`select kind, pattern, reason from filters`) as unknown as Filter[];

    const { uidValidity, messages } = await fetchNewMail(cursor);
    read = messages.length;

    const keep: MailMessage[] = [];
    const skips = new Map<number, string>();
    for (const m of messages) {
      const r = skipReason(m, filters);
      if (r) { skips.set(m.uid, r); skipped++; } else keep.push(m);
    }

    const results: Map<number, Extracted> = await extract(keep, today);

    for (const m of messages) {
      const skip = skips.get(m.uid) ?? null;
      const x = skip ? undefined : results.get(keep.indexOf(m));
      const f = await applyMessage(sql, runId, uidValidity, m, x, skip);
      if (f) { fresh.push(f); extracted++; }
      else if (!skip && x && (x.category === "promo" || x.category === "bid_invite")) skipped++;
    }

    // Move the cursor only after everything above is saved, so a crash never loses mail.
    const lastUid = messages.length ? Math.max(...messages.map((m) => m.uid)) : cursor?.uidValidity === uidValidity ? cursor.lastUid : 0;
    await sql`insert into settings (key, value) values ('imap_cursor', ${sql.json({ uidValidity, lastUid })})
      on conflict (key) do update set value = excluded.value, updated_at = now()`;
  } catch (e) {
    failure = (e as Error).message || String(e);
    console.error("Run failed:", failure);
  }

  const label = SLOT_LABEL[opts.slot] ?? opts.slot;
  const rd = await buildRundown(sql, today, fresh, failure, label);
  await sql`update runs set finished_at = now(), window_end = now(), status = ${failure ? "failed" : "ok"}, error = ${failure},
    read_count = ${read}, skipped_count = ${skipped}, extracted_count = ${extracted} where id = ${runId}`;
  const [saved] = await sql`insert into rundowns (run_id, needs_today, coming_up, fyi, failed, text)
    values (${runId}, ${sql.json(rd.needs_today)}, ${sql.json(rd.coming_up)}, ${sql.json(rd.fyi)}, ${rd.failed}, ${rd.text}) returning id`;

  const base = process.env.APP_URL || "";
  const title = failure ? `${label} rundown: couldn't read inbox` : `${label} rundown`;
  const body = failure
    ? `Couldn't read your inbox: ${failure}`
    : `Today: ${rd.needs_today.length ? rd.needs_today.slice(0, 3).join("; ") : "nothing"}${rd.needs_today.length > 3 ? ` (+${rd.needs_today.length - 3} more)` : ""}. Coming up: ${rd.coming_up.length}. FYI: ${rd.fyi.length}.`;
  const payload = { title, body, url: `${base}/rundowns/${saved.id}` };
  let delivered = 0;
  try { delivered = await sendPush(sql, payload); } catch (e) { console.error("push error", e); }
  if (!delivered) { try { if (await sendPushover(payload)) delivered = 1; } catch (e) { console.error("pushover error", e); } }
  await sql`update rundowns set push_sent = ${delivered > 0} where id = ${saved.id}`;

  console.log(rd.text);
  console.log(`\nread=${read} skipped=${skipped} extracted=${extracted} pushed=${delivered}`);
  return { runId, rundownId: saved.id as number, rundown: rd, failure };
}

