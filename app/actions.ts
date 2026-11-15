"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth, endSession } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { chicagoLocalToDate, chicagoToday } from "@/lib/time";

const str = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v || null; };
const num = (f: FormData, k: string) => { const v = str(f, k); if (!v) return null; const n = Number(v.replace(/[$,]/g, "")); return Number.isFinite(n) ? n : null; };
const id = (f: FormData) => Number(f.get("id"));
const done = (...paths: string[]) => { for (const p of ["/", ...paths]) revalidatePath(p); };

export async function signOut() { await endSession(); redirect("/login"); }

// ---------- Open items ----------
export async function addOpenItem(f: FormData) {
  await requireAuth();
  await db()`insert into open_items (kind, title, detail, amount, due_date)
    values (${str(f, "kind") || "other"}, ${str(f, "title") || "Untitled"}, ${str(f, "detail")}, ${num(f, "amount")}, ${str(f, "due_date")})`;
  done("/items");
}
export async function setOpenItemStatus(f: FormData) {
  await requireAuth();
  const status = str(f, "status") === "done" ? "done" : "open";
  await db()`update open_items set status = ${status}, done_at = ${status === "done" ? new Date() : null} where id = ${id(f)}`;
  done("/items");
}
export async function deleteOpenItem(f: FormData) {
  await requireAuth();
  await db()`delete from open_items where id = ${id(f)}`;
  done("/items");
}

// ---------- Bills ----------
export async function addBill(f: FormData) {
  await requireAuth();
  await db()`insert into bills (biller, amount, due_date, autopay, status, notes)
    values (${str(f, "biller") || "Unknown"}, ${num(f, "amount")}, ${str(f, "due_date")}, ${f.get("autopay") === "on"}, 'unconfirmed', ${str(f, "notes")})`;
  done("/bills");
}
/** Only path to paid / due / past due: Cody confirms he checked the biller's or bank's site. */
export async function verifyBill(f: FormData) {
  await requireAuth();
  const status = str(f, "status");
  if (!status || !["paid", "due", "past_due", "unconfirmed"].includes(status)) return;
  if (status !== "unconfirmed" && f.get("checked") !== "on") return;
  await db()`update bills set status = ${status}, verified_at = ${status === "unconfirmed" ? null : new Date()} where id = ${id(f)}`;
  if (status === "paid") {
    const [b] = await db()`select source_mail_id from bills where id = ${id(f)}`;
    if (b?.source_mail_id) await db()`update open_items set status = 'done', done_at = now() where source_mail_id = ${b.source_mail_id} and status = 'open'`;
  }
  done("/bills");
}
export async function setAutopay(f: FormData) {
  await requireAuth();
  await db()`update bills set autopay = ${str(f, "autopay") === "on"} where id = ${id(f)}`;
  done("/bills");
}
export async function deleteBill(f: FormData) {
  await requireAuth();
  await db()`delete from bills where id = ${id(f)}`;
  done("/bills");
}

// ---------- Declines ----------
export async function addDecline(f: FormData) {
  await requireAuth();
  const when = str(f, "occurred_at");
  await db()`insert into card_declines (merchant, amount, occurred_at, card_last4, notes)
    values (${str(f, "merchant")}, ${num(f, "amount")}, ${when ? chicagoLocalToDate(when) : new Date()}, ${str(f, "card_last4")}, ${str(f, "notes")})`;
  done("/declines");
}
export async function deleteDecline(f: FormData) {
  await requireAuth();
  await db()`delete from card_declines where id = ${id(f)}`;
  done("/declines");
}

// ---------- Kids ----------
export async function addKidNote(f: FormData) {
  await requireAuth();
  await db()`insert into kid_notes (kid_id, kind, class_name, text) values (${Number(f.get("kid_id"))}, ${str(f, "kind") || "note"}, ${str(f, "class_name")}, ${str(f, "text") || ""})`;
  done("/kids");
}
export async function addLunch(f: FormData) {
  await requireAuth();
  await db()`insert into lunch_transactions (kid_id, occurred_on, description, amount, balance_after)
    values (${Number(f.get("kid_id"))}, ${str(f, "occurred_on") || chicagoToday()}, ${str(f, "description")}, ${num(f, "amount")}, ${num(f, "balance_after")})`;
  done("/kids");
}
export async function addSchoolEvent(f: FormData) {
  await requireAuth();
  const kid = Number(f.get("kid_id")) || null;
  await db()`insert into school_events (kid_id, title, event_date, location) values (${kid}, ${str(f, "title") || "Event"}, ${str(f, "event_date")}, ${str(f, "location")})`;
  done("/kids");
}
export async function deleteKidRow(f: FormData) {
  await requireAuth();
  const t = str(f, "table");
  const sql = db();
  if (t === "note") await sql`delete from kid_notes where id = ${id(f)}`;
  if (t === "lunch") await sql`delete from lunch_transactions where id = ${id(f)}`;
  if (t === "event") await sql`delete from school_events where id = ${id(f)}`;
  done("/kids");
}

// ---------- Jobs ----------
export async function saveRecruiter(f: FormData) {
  await requireAuth();
  const v = {
    name: str(f, "name"), company: str(f, "company"), role: str(f, "role"), pay: str(f, "pay"), location: str(f, "location"),
    status: str(f, "status") || "new", next_step: str(f, "next_step"), next_step_date: str(f, "next_step_date"), notes: str(f, "notes"),
  };
  const sql = db();
  if (f.get("id")) await sql`update recruiters set ${sql(v)} where id = ${id(f)}`;
  else await sql`insert into recruiters ${sql(v)}`;
  done("/jobs");
}
export async function deleteRecruiter(f: FormData) {
  await requireAuth();
  await db()`delete from recruiters where id = ${id(f)}`;
  done("/jobs");
}

// ---------- Trips & events ----------
export async function saveTrip(f: FormData) {
  await requireAuth();
  const v = { kind: str(f, "kind") || "event", title: str(f, "title") || "Untitled", start_date: str(f, "start_date"), end_date: str(f, "end_date"), people: str(f, "people"), notes: str(f, "notes") };
  const sql = db();
  if (f.get("id")) await sql`update trips_events set ${sql(v)} where id = ${id(f)}`;
  else await sql`insert into trips_events ${sql(v)}`;
  done("/trips");
}
export async function deleteTrip(f: FormData) {
  await requireAuth();
  await db()`delete from trips_events where id = ${id(f)}`;
  done("/trips");
}

// ---------- Settings ----------
export async function addFilter(f: FormData) {
  await requireAuth();
  const kind = str(f, "kind");
  const pattern = str(f, "pattern")?.toLowerCase();
  if (!kind || !pattern || !["sender_domain", "sender_contains", "subject_contains"].includes(kind)) return;
  await db()`insert into filters (kind, pattern, reason) values (${kind}, ${pattern}, ${str(f, "reason") || "promo"}) on conflict do nothing`;
  done("/settings");
}
export async function removeFilter(f: FormData) {
  await requireAuth();
  await db()`delete from filters where id = ${id(f)}`;
  done("/settings");
}
/** Stores a credential encrypted. It is never read back to the browser. */
export async function saveSecret(f: FormData) {
  await requireAuth();
  const name = str(f, "name"), value = str(f, "value");
  if (!name || !value) return;
  await db()`insert into secrets (name, ciphertext) values (${name}, ${encrypt(value)})
    on conflict (name) do update set ciphertext = excluded.ciphertext, updated_at = now()`;
  done("/settings");
}
export async function deleteSecret(f: FormData) {
  await requireAuth();
  await db()`delete from secrets where name = ${str(f, "name")}`;
  done("/settings");
}
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  await requireAuth();
  if (!sub?.endpoint?.startsWith("https://")) return { ok: false };
  const sql = db();
  await sql`insert into push_subscriptions (endpoint, keys) values (${sub.endpoint}, ${sql.json(sub.keys)})
    on conflict (endpoint) do update set keys = excluded.keys`;
  return { ok: true };
}
export async function sendTestPush() {
  await requireAuth();
  const { sendPush } = await import("@/lib/push");
  const n = await sendPush(db(), { title: "Ops Manager", body: "Test notification. Rundowns will arrive like this.", url: "/" });
  return { sent: n };
}
export async function runNow() {
  await requireAuth();
  const { runOnce } = await import("@/job/run");
  const r = await runOnce({ slot: "manual" });
  done("/rundowns");
  if (r) redirect(`/rundowns/${r.rundownId}`);
}
