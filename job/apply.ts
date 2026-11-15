import type postgres from "postgres";
import type { MailMessage } from "./mail";
import type { Extracted } from "./extract";

type Sql = ReturnType<typeof postgres>;

export type Fresh = { urgency: "today" | "upcoming" | "fyi"; line: string; openItemId: number | null; date: string | null };

export const slug = (s: string | null | undefined) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "x";
const validDate = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

/** Records each message and folds what was found into the trackers. Everything from email stays unconfirmed. */
export async function applyMessage(
  sql: Sql, runId: number, uidValidity: string, m: MailMessage, x: Extracted | undefined, skip: string | null,
): Promise<Fresh | null> {
  const category = skip ? null : x?.category ?? "other";
  const dropped = skip || category === "promo" || category === "bid_invite";
  const [row] = await sql`
    insert into mail_seen (run_id, uid, uid_validity, message_id, from_addr, subject, received_at, category, skip_reason, summary)
    values (${runId}, ${m.uid}, ${uidValidity}, ${m.messageId}, ${m.from}, ${m.subject}, ${m.date}, ${category},
            ${skip ?? (dropped ? category : null)}, ${x?.summary ?? null})
    on conflict (uid_validity, uid) do update set run_id = excluded.run_id
    returning id`;
  if (dropped || !x) return null;
  const mailId = row.id as number;
  const date = validDate(x.date);
  const kidId = x.kid ? (await sql`select id from kids where name = ${x.kid}`)[0]?.id ?? null : null;

  if (x.category === "bill") {
    const key = `bill:${slug(x.party)}:${date ?? "nodate"}`;
    await sql`
      insert into bills (biller, amount, due_date, autopay, status, email_says, source_mail_id, dedupe_key)
      values (${x.party || "Unknown biller"}, ${x.amount}, ${date}, ${x.autopay}, 'unconfirmed', ${x.email_says}, ${mailId}, ${key})
      on conflict (dedupe_key) do update set
        amount = coalesce(excluded.amount, bills.amount),
        autopay = coalesce(excluded.autopay, bills.autopay),
        email_says = excluded.email_says,
        source_mail_id = excluded.source_mail_id,
        -- a new email never overrides something Cody verified himself
        status = case when bills.verified_at is null then 'unconfirmed' else bills.status end`;
  }

  if (x.category === "payment_failed") {
    await sql`
      insert into card_declines (merchant, amount, occurred_at, card_last4, notes, source_mail_id, dedupe_key)
      values (${x.party}, ${x.amount}, ${m.date}, ${x.card_last4}, ${x.summary}, ${mailId}, ${`decline:${uidValidity}:${m.uid}`})
      on conflict (dedupe_key) do nothing`;
  }

  if (x.category === "kids_school" && kidId) {
    if (x.kid_note_kind === "lunch") {
      await sql`
        insert into lunch_transactions (kid_id, occurred_on, description, amount, balance_after, source_mail_id)
        values (${kidId}, ${date ?? m.date}, ${x.summary}, ${x.amount}, ${x.lunch_balance}, ${mailId})`;
    } else if (x.kid_note_kind === "event") {
      await sql`
        insert into school_events (kid_id, title, event_date, source_mail_id, dedupe_key)
        values (${kidId}, ${x.summary}, ${date}, ${mailId}, ${`event:${kidId}:${date}:${slug(x.summary)}`})
        on conflict (dedupe_key) do nothing`;
    } else {
      await sql`
        insert into kid_notes (kid_id, kind, text, noted_on, source_mail_id)
        values (${kidId}, ${x.kid_note_kind === "grade" || x.kid_note_kind === "missing_work" ? x.kid_note_kind : "note"}, ${x.summary}, ${m.date}, ${mailId})`;
    }
  } else if (x.category === "kids_school" && x.kid_note_kind === "event") {
    await sql`
      insert into school_events (kid_id, title, event_date, source_mail_id, dedupe_key)
      values (null, ${x.summary}, ${date}, ${mailId}, ${`event:all:${date}:${slug(x.summary)}`})
      on conflict (dedupe_key) do nothing`;
  }

  if (x.category === "job" && (x.job_company || x.recruiter_name)) {
    await sql`
      insert into recruiters (name, company, role, pay, location, last_contact, notes, source_mail_id, dedupe_key)
      values (${x.recruiter_name}, ${x.job_company}, ${x.job_role}, ${x.job_pay}, ${x.job_location}, ${m.date}, ${x.summary}, ${mailId},
              ${`rec:${slug(x.job_company)}:${slug(x.recruiter_name)}`})
      on conflict (dedupe_key) do update set
        role = coalesce(excluded.role, recruiters.role),
        pay = coalesce(excluded.pay, recruiters.pay),
        location = coalesce(excluded.location, recruiters.location),
        last_contact = excluded.last_contact,
        notes = excluded.notes,
        source_mail_id = excluded.source_mail_id`;
  }

  if (x.category === "trip" && date) {
    await sql`
      insert into trips_events (kind, title, start_date, notes, dedupe_key)
      values ('trip', ${x.party || x.summary}, ${date}, ${x.summary}, ${`trip:${slug(x.party || x.summary)}:${date}`})
      on conflict (dedupe_key) do nothing`;
  }

  let openItemId: number | null = null;
  if (x.open_item_kind !== "none") {
    const key = `${x.open_item_kind}:${slug(x.party || x.summary)}:${date ?? "nodate"}`;
    const [oi] = await sql`
      insert into open_items (kind, title, detail, amount, due_date, source_mail_id, dedupe_key)
      values (${x.open_item_kind}, ${titleFor(x)}, ${x.summary}, ${x.amount}, ${date}, ${mailId}, ${key})
      on conflict (dedupe_key) do update set
        detail = excluded.detail,
        amount = coalesce(excluded.amount, open_items.amount),
        source_mail_id = excluded.source_mail_id
      returning id`;
    openItemId = oi.id;
  }

  return { urgency: x.urgency, line: x.summary, openItemId, date };
}

function titleFor(x: Extracted) {
  const who = x.party || "";
  switch (x.open_item_kind) {
    case "bill": return `${who || "Bill"}${x.email_says === "past_due" ? " past due" : " bill"}`.trim();
    case "shutoff": return `${who} shutoff notice`.trim();
    case "locked_card": return `${who} card locked${x.card_last4 ? ` (…${x.card_last4})` : ""}`.trim();
    case "settlement": return `${who} settlement offer`.trim();
    case "package": return `${who} package`.trim();
    case "appointment": return `${who} appointment${x.time ? ` at ${x.time}` : ""}`.trim();
    default: return x.summary.slice(0, 90);
  }
}
