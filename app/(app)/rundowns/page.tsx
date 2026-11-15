import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";

export default async function History() {
  const rows = await db()`select r.id, r.created_at, r.failed, r.push_sent, jsonb_array_length(r.needs_today) as n,
      runs.slot, runs.read_count, runs.skipped_count
    from rundowns r join runs on runs.id = r.run_id order by r.id desc limit 120`;
  return (
    <div className="stack">
      <h1>Rundown history</h1>
      {!rows.length && <p className="muted">Nothing yet.</p>}
      <ul className="list">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/rundowns/${r.id}`}>
              <strong>{fmtDateTime(r.created_at)}</strong>{" "}
              {r.failed ? <span className="badge bad">couldn&apos;t read inbox</span> : <span className="muted">{r.n} need you · {r.read_count} emails read, {r.skipped_count} skipped</span>}
              {!r.push_sent && <span className="badge">not pushed</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
