import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";
import { RundownView } from "@/components/ui";

export default async function RundownPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sql = db();
  const [r] = await sql`select r.*, runs.window_start, runs.window_end, runs.read_count, runs.skipped_count from rundowns r join runs on runs.id = r.run_id where r.id = ${Number(id)}`;
  if (!r) notFound();
  const mail = await sql`select from_addr, subject, category, skip_reason, summary from mail_seen where run_id = ${r.run_id} order by id`;
  return (
    <div className="stack">
      <h1>Rundown · {fmtDateTime(r.created_at)}</h1>
      <p className="muted">Mail since {r.window_start ? fmtDateTime(r.window_start) : "the first check"} · {r.read_count} read, {r.skipped_count} skipped</p>
      <RundownView r={r as never} />
      {mail.length > 0 && (
        <details className="card">
          <summary>Emails in this check ({mail.length})</summary>
          <ul className="small-list">
            {mail.map((m, i) => (
              <li key={i}><span className={`badge ${m.skip_reason ? "" : "ok"}`}>{m.skip_reason ? `skipped: ${m.skip_reason}` : m.category}</span> {m.subject} <span className="muted">{m.from_addr}</span></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
