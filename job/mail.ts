import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { readFileSync } from "node:fs";

export type MailMessage = {
  uid: number;
  messageId: string | null;
  from: string;        // "Name <addr@domain>"
  fromAddr: string;    // addr@domain, lowercased
  subject: string;
  date: Date;
  text: string;        // plain text body, trimmed
  listUnsubscribe: boolean;
};

export type Cursor = { uidValidity: string; lastUid: number };

export type FetchResult = { uidValidity: string; messages: MailMessage[] };

const MAX_BODY = 4000;
const FIRST_RUN_LOOKBACK_HOURS = 24;
const MAX_PER_RUN = 200;

/**
 * Read new mail from Yahoo over IMAP. The mailbox is opened READ-ONLY (EXAMINE),
 * so nothing is marked read, moved or deleted. No sending credentials exist anywhere.
 */
export async function fetchNewMail(cursor: Cursor | null): Promise<FetchResult> {
  if (process.env.MAIL_SOURCE === "fixture") return fetchFixture(cursor);

  const user = process.env.YAHOO_EMAIL;
  const pass = process.env.YAHOO_APP_PASSWORD;
  if (!user || !pass) throw new Error("Yahoo login is not set up (YAHOO_EMAIL / YAHOO_APP_PASSWORD missing)");

  const client = new ImapFlow({
    host: process.env.IMAP_HOST || "imap.mail.yahoo.com",
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_SECURE !== "false",
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
  } catch (e: unknown) {
    const err = e as { authenticationFailed?: boolean; message?: string };
    if (err.authenticationFailed) throw new Error("Yahoo rejected the login. The app password may have been revoked or mistyped.");
    throw new Error(`Couldn't connect to Yahoo: ${err.message ?? String(e)}`);
  }

  try {
    const mailbox = await client.mailboxOpen("INBOX", { readOnly: true });
    const uidValidity = String(mailbox.uidValidity);

    let uids: number[];
    if (cursor && cursor.uidValidity === uidValidity) {
      const found = await client.search({ uid: `${cursor.lastUid + 1}:*` }, { uid: true });
      uids = (found || []).filter((u) => u > cursor.lastUid);
    } else {
      // First run (or Yahoo reset the mailbox IDs): look back a day only.
      const since = new Date(Date.now() - FIRST_RUN_LOOKBACK_HOURS * 3600_000);
      uids = (await client.search({ since }, { uid: true })) || [];
    }
    uids.sort((a, b) => a - b);
    if (uids.length > MAX_PER_RUN) uids = uids.slice(-MAX_PER_RUN);

    const messages: MailMessage[] = [];
    if (uids.length) {
      for await (const msg of client.fetch(uids.join(","), { uid: true, source: true }, { uid: true })) {
        if (!msg.source) continue;
        messages.push(await parse(msg.uid, msg.source));
      }
    }
    messages.sort((a, b) => a.uid - b.uid);
    return { uidValidity, messages };
  } finally {
    await client.logout().catch(() => client.close());
  }
}

async function parse(uid: number, source: Buffer): Promise<MailMessage> {
  const p = await simpleParser(source);
  const fromVal = p.from?.value?.[0];
  const fromAddr = (fromVal?.address || "").toLowerCase();
  let text = p.text || "";
  if (!text && typeof p.html === "string") text = htmlToText(p.html);
  return {
    uid,
    messageId: p.messageId || null,
    from: p.from?.text || fromAddr,
    fromAddr,
    subject: p.subject || "(no subject)",
    date: p.date || new Date(),
    text: squeeze(text).slice(0, MAX_BODY),
    listUnsubscribe: p.headers.has("list-unsubscribe"),
  };
}

function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"');
}

function squeeze(s: string) {
  return s.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}

/** Test mode: read messages from a JSON file instead of Yahoo. */
function fetchFixture(cursor: Cursor | null): FetchResult {
  const path = process.env.MAIL_FIXTURE || "test/fixtures/inbox.json";
  if (process.env.MAIL_FIXTURE_FAIL) throw new Error(process.env.MAIL_FIXTURE_FAIL);
  const data = JSON.parse(readFileSync(/*turbopackIgnore: true*/ path, "utf8")) as { uidValidity: string; messages: (Omit<MailMessage, "date" | "fromAddr"> & { date: string })[] };
  const last = cursor && cursor.uidValidity === data.uidValidity ? cursor.lastUid : 0;
  return {
    uidValidity: data.uidValidity,
    messages: data.messages
      .filter((m) => m.uid > last)
      .map((m) => ({ ...m, date: new Date(m.date), fromAddr: (m.from.match(/<([^>]+)>/)?.[1] || m.from).toLowerCase() })),
  };
}
