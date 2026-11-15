import * as webpush from "web-push";
import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

export function pushConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/** Sends to every registered device. Returns how many devices got it. */
export async function sendPush(sql: Sql, payload: { title: string; body: string; url: string }) {
  if (!pushConfigured()) return 0;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:ops-manager@example.com", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const subs = await sql`select endpoint, keys from push_subscriptions`;
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 6 * 3600 });
      sent++;
    } catch (e: unknown) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sql`delete from push_subscriptions where endpoint = ${s.endpoint}`;
      else console.error("push failed", code, (e as Error).message);
    }
  }
  return sent;
}

/** Optional backup channel: Pushover (one-time $5 app). */
export async function sendPushover(payload: { title: string; body: string; url: string }) {
  const token = process.env.PUSHOVER_TOKEN, user = process.env.PUSHOVER_USER;
  if (!token || !user) return false;
  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, user, title: payload.title, message: payload.body.slice(0, 1000), url: payload.url }),
  });
  return res.ok;
}
