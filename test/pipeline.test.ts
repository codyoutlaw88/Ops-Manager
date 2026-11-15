/** End-to-end run against a fake mailbox. Needs a throwaway Postgres in TEST_DATABASE_URL. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const url = process.env.TEST_DATABASE_URL;

test("fake mailbox -> trackers -> rundown", { skip: !url && "set TEST_DATABASE_URL to run" }, async () => {
  process.env.DATABASE_URL = url;
  process.env.MAIL_SOURCE = "fixture";
  process.env.EXTRACTOR = "fake";
  const { db } = await import("../lib/db");
  const { runOnce } = await import("../job/run");
  const sql = db();
  await sql.unsafe("drop schema public cascade; create schema public;");
  await sql.unsafe(readFileSync("db/schema.sql", "utf8"));

  const now = new Date("2026-11-15T12:00:00Z");
  const r1 = await runOnce({ slot: "6am", now });
  assert.ok(r1 && !r1.failure);
  const t = r1!.rundown;
  assert.ok(t.needs_today.some((l) => l.includes("Atmos") && l.includes("unconfirmed")));
  assert.ok(t.needs_today.some((l) => l.includes("declined")));
  assert.ok(t.fyi.some((l) => l.includes("Hensel Phelps")));
  assert.ok(!t.text.includes("PlanHub") && !t.text.includes("Old Navy"));

  const [bill] = await sql`select status, email_says from bills where biller = 'Atmos Energy'`;
  assert.equal(bill.status, "unconfirmed");
  assert.equal(bill.email_says, "past_due");
  assert.equal((await sql`select count(*)::int as n from card_declines`)[0].n, 1);
  assert.equal((await sql`select count(*)::int as n from recruiters`)[0].n, 1);

  // Same slot twice in one day is skipped; a later slot reads only new mail but carries open items.
  assert.equal(await runOnce({ slot: "6am", now }), null);
  const r2 = await runOnce({ slot: "11am", now: new Date("2026-11-15T17:00:00Z") });
  assert.equal(r2!.rundown.fyi.length, 0);
  assert.ok(r2!.rundown.needs_today.some((l) => l.includes("Atmos")));

  // Inbox failure is reported plainly.
  process.env.MAIL_FIXTURE_FAIL = "Yahoo rejected the login.";
  const r3 = await runOnce({ slot: "3pm", now: new Date("2026-11-15T21:00:00Z") });
  delete process.env.MAIL_FIXTURE_FAIL;
  assert.ok(r3!.failure);
  assert.match(r3!.rundown.text, /COULDN'T READ YOUR INBOX/);
  await sql.end();
});
