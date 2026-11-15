import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDateTime, chicagoToday, toIso } from "@/lib/time";
import { RundownView } from "@/components/ui";
import { openItemLine } from "@/job/rundown";
import { runNow, setOpenItemStatus } from "../actions";

export const maxDuration = 60;

export default async function Today() {
  const sql = db();
  const today = chicagoToday();
  const [latest] = await sql`select * from rundowns order by id desc limit 1`;
  const open = await sql`select id, kind, title, amount, due_date from open_items where status = 'open' order by due_date nulls last, id`;
  return (
    <div className="stack">
      <div className="row between">
        <h1>Today</h1>
        {process.env.YAHOO_APP_PASSWORD && <form action={runNow}><button className="small">Check mail now</button></form>}
      </div>
      {latest ? (
        <>
          <p className="muted small">Latest rundown · {fmtDateTime(latest.created_at)} · <Link href="/rundowns">history</Link></p>
          <RundownView r={latest as never} />
        </>
      ) : <p className="muted">No rundowns yet. The first one comes at the next 6 AM, 11 AM or 3 PM check.</p>}

      <h2 className="sub">Open items ({open.length})</h2>
      <ul className="list">
        {open.map((o) => {
          const late = toIso(o.due_date) && toIso(o.due_date)! < today;
          return (
            <li key={o.id} className={late ? "late" : ""}>
              <div>{openItemLine(o as never, today)}</div>
              <form action={setOpenItemStatus} className="inline">
                <input type="hidden" name="id" value={o.id} />
                <input type="hidden" name="status" value="done" />
                <button className="small">Done</button>
              </form>
            </li>
          );
        })}
      </ul>
      {!open.length && <p className="muted">Nothing open.</p>}
    </div>
  );
}
