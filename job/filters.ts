import type { MailMessage } from "./mail";

export type Filter = { kind: "sender_domain" | "sender_contains" | "subject_contains"; pattern: string; reason: string };

/** Returns a skip reason if a rule matches, or null to keep the message. Free: no AI call. */
export function skipReason(m: MailMessage, filters: Filter[]): string | null {
  const domain = m.fromAddr.split("@")[1] || "";
  const from = m.from.toLowerCase();
  const subject = m.subject.toLowerCase();
  for (const f of filters) {
    const p = f.pattern.toLowerCase();
    if (f.kind === "sender_domain" && (domain === p || domain.endsWith("." + p))) return f.reason;
    if (f.kind === "sender_contains" && from.includes(p)) return f.reason;
    if (f.kind === "subject_contains" && subject.includes(p)) return f.reason;
  }
  return null;
}
