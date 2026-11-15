import { test } from "node:test";
import assert from "node:assert/strict";
import { skipReason, type Filter } from "../job/filters";
import { currentSlot, chicagoLocalToDate, chicagoToday } from "../lib/time";
import { openItemLine } from "../job/rundown";
import type { MailMessage } from "../job/mail";

const msg = (from: string, subject = "hi"): MailMessage => ({
  uid: 1, messageId: null, from, fromAddr: (from.match(/<(.+)>/)?.[1] ?? from).toLowerCase(), subject, date: new Date(), text: "", listUnsubscribe: false,
});
const filters: Filter[] = [
  { kind: "sender_domain", pattern: "planhub.com", reason: "bid_invite" },
  { kind: "sender_contains", pattern: "summit gc", reason: "bid_invite" },
  { kind: "subject_contains", pattern: "invitation to bid", reason: "bid_invite" },
];

test("skip rules catch bid invites but not bills", () => {
  assert.equal(skipReason(msg("PlanHub <noreply@mail.planhub.com>"), filters), "bid_invite");
  assert.equal(skipReason(msg("Summit GC Estimating <est@summitgc.net>"), filters), "bid_invite");
  assert.equal(skipReason(msg("Jo <jo@x.com>", "Invitation to Bid: Gym"), filters), "bid_invite");
  assert.equal(skipReason(msg("Summit Bank <alerts@summitbank.com>"), filters), null);
  assert.equal(skipReason(msg("Atmos <billing@atmosenergy.com>", "Your bill"), filters), null);
});

test("rundown hours follow Chicago time through daylight saving", () => {
  assert.equal(currentSlot(new Date("2026-11-15T12:00:00Z")), "6am");  // CST
  assert.equal(currentSlot(new Date("2026-07-15T11:00:00Z")), "6am");  // CDT
  assert.equal(currentSlot(new Date("2026-07-15T12:00:00Z")), null);
  assert.equal(currentSlot(new Date("2026-11-15T21:05:00Z")), "3pm");
  assert.equal(currentSlot(new Date("2026-07-15T16:30:00Z")), "11am");
});

test("phone-entered times are read as Chicago time", () => {
  assert.equal(chicagoLocalToDate("2026-11-14T18:30").toISOString(), "2026-11-15T00:30:00.000Z");
  assert.equal(chicagoLocalToDate("2026-07-14T18:30").toISOString(), "2026-07-14T23:30:00.000Z");
  assert.equal(chicagoToday(new Date("2026-11-15T03:30:00Z")), "2026-11-14");
});

test("money items always say unconfirmed", () => {
  const line = openItemLine({ id: 1, kind: "bill", title: "Atmos Energy past due", amount: 142.17, due_date: new Date("2026-11-10") }, "2026-11-14");
  assert.match(line, /\$142\.17/);
  assert.match(line, /late/);
  assert.match(line, /unconfirmed/);
  assert.doesNotMatch(openItemLine({ id: 2, kind: "package", title: "Amazon package", amount: null, due_date: new Date("2026-11-17") }, "2026-11-14"), /unconfirmed/);
});

test("credentials round-trip through encryption and the ciphertext hides them", async () => {
  process.env.ENCRYPTION_KEY = "x".repeat(40);
  const { encrypt, decrypt } = await import("../lib/crypto");
  const c = encrypt("hunter2-secret");
  assert.ok(!c.includes("hunter2"));
  assert.equal(decrypt(c), "hunter2-secret");
});
