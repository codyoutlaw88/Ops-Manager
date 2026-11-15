import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { MailMessage } from "./mail";

export const Category = z.enum([
  "bill", "payment_failed", "account_alert", "kids_school", "delivery", "appointment", "job", "personal", "trip", "promo", "bid_invite", "other",
]);

const Item = z.object({
  index: z.number().int().describe("The [n] number of the email this result is for"),
  category: Category,
  urgency: z.enum(["today", "upcoming", "fyi"]).describe("today = needs Cody's action today or is already late; upcoming = has a future date; fyi = info only"),
  summary: z.string().describe("One short plain-English line with every amount and date. No advice, no follow-up suggestions."),
  amount: z.number().nullable(),
  date: z.string().nullable().describe("Key date as YYYY-MM-DD: due date, shutoff date, delivery date, appointment or event date"),
  time: z.string().nullable().describe("HH:MM 24h local time if the email gives one"),
  party: z.string().nullable().describe("Biller, merchant, bank, store, school or company name"),
  email_says: z.enum(["due", "paid", "past_due", "failed", "scheduled", "none"]).describe("What the email claims about a payment"),
  autopay: z.boolean().nullable(),
  card_last4: z.string().nullable(),
  kid: z.enum(["Ryan", "Karsyn", "Korie"]).nullable(),
  kid_note_kind: z.enum(["grade", "missing_work", "lunch", "event", "note"]).nullable(),
  lunch_balance: z.number().nullable(),
  open_item_kind: z.enum(["bill", "shutoff", "locked_card", "settlement", "package", "trip", "birthday", "appointment", "other", "none"])
    .describe("Kind of open item to track until Cody marks it done, or none"),
  recruiter_name: z.string().nullable(),
  job_company: z.string().nullable(),
  job_role: z.string().nullable(),
  job_pay: z.string().nullable(),
  job_location: z.string().nullable(),
});
export type Extracted = z.infer<typeof Item>;

const Result = z.object({ items: z.array(Item) });

function system(today: string) {
  return `You sort a busy dad's email into a short daily rundown. Today is ${today} (America/Chicago).
Cody is a construction project manager who is job hunting. Kids: Ryan (15, 9th grade, Jim Ned High), Karsyn (13, 8th grade, Jim Ned Middle), Korie (turns 10 on Nov 28). School lunch accounts are on MySchoolBucks.

For every email return exactly one item with its [n] index.
- promo: ads, sales, newsletters, marketing, surveys. bid_invite: construction bid invitations (PlanHub, BuildingConnected, Summit GC, ITBs). These are dropped, so keep their summary to a few words.
- bill: statements and due notices. payment_failed: declined cards, failed or returned payments. account_alert: fraud, locked or frozen cards, credit alerts, low balance, settlement offers, collections, shutoff notices.
- kids_school: grades, missing work, lunch balance/transactions, school events. Set kid when the email is about one child.
- job: recruiters, applications, interviews. Fill the recruiter/job fields you can find.
- Always copy exact amounts and dates from the email. Never invent missing values: use null.
- email_says only reports what the email claims. Do not judge whether a bill is really paid.
- summary: one line, plain English, no fluff, no advice.`;
}

function render(m: MailMessage, i: number) {
  return `[${i}] From: ${m.from}\nDate: ${m.date.toISOString()}\nSubject: ${m.subject}\n\n${m.text}`;
}

const BATCH = 12;

export async function extract(messages: MailMessage[], today: string): Promise<Map<number, Extracted>> {
  const out = new Map<number, Extracted>();
  if (!messages.length) return out;
  if (process.env.EXTRACTOR === "fake") return fakeExtract(messages, today);

  const client = new Anthropic();
  const model = process.env.AI_MODEL || "claude-haiku-5-5";
  for (let start = 0; start < messages.length; start += BATCH) {
    const chunk = messages.slice(start, start + BATCH);
    const body = chunk.map((m, j) => render(m, start + j)).join("\n\n---\n\n");
    const res = await client.messages.parse({
      model,
      max_tokens: 8000,
      output_config: { effort: "low", format: zodOutputFormat(Result) },
      system: system(today),
      messages: [{ role: "user", content: `Emails:\n\n${body}` }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      throw new Error(`The AI step couldn't read emails ${start + 1}-${start + chunk.length} (${res.stop_reason}).`);
    }
    for (const it of res.parsed_output.items) {
      if (it.index >= start && it.index < start + chunk.length) out.set(it.index, it);
    }
  }
  return out;
}

/**
 * Offline stand-in used only by tests (EXTRACTOR=fake). Reads a JSON hint embedded in fixture
 * emails so the pipeline can be tested without an API key.
 */
function fakeExtract(messages: MailMessage[], _today: string) {
  const out = new Map<number, Extracted>();
  messages.forEach((m, i) => {
    const hint = m.text.match(/<!--extract (.*?)-->/s)?.[1];
    const base: Extracted = {
      index: i, category: "other", urgency: "fyi", summary: m.subject, amount: null, date: null, time: null, party: null,
      email_says: "none", autopay: null, card_last4: null, kid: null, kid_note_kind: null, lunch_balance: null,
      open_item_kind: "none", recruiter_name: null, job_company: null, job_role: null, job_pay: null, job_location: null,
    };
    out.set(i, hint ? { ...base, ...JSON.parse(hint), index: i } : base);
  });
  return out;
}
