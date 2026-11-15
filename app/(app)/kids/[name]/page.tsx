import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtDate, fmtMoney } from "@/lib/time";
import { addKidNote, addLunch, addSchoolEvent, deleteKidRow } from "../../../actions";
import { Del } from "@/components/ui";

export default async function Kid({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const sql = db();
  const [k] = await sql`select * from kids where lower(name) = lower(${decodeURIComponent(name)})`;
  if (!k) notFound();
  const [notes, lunch, events] = await Promise.all([
    sql`select * from kid_notes where kid_id = ${k.id} order by noted_on desc, id desc limit 50`,
    sql`select * from lunch_transactions where kid_id = ${k.id} order by occurred_on desc, id desc limit 30`,
    sql`select * from school_events where (kid_id = ${k.id} or kid_id is null) and (event_date is null or event_date >= current_date - 1) order by event_date nulls last limit 30`,
  ]);
  const balance = lunch.find((l) => l.balance_after != null)?.balance_after;
  return (
    <div className="stack">
      <h1>{k.name}</h1>
      <p className="muted">{[k.grade && `${k.grade} grade`, k.school, k.birthday && `birthday ${fmtDate(k.birthday)}`].filter(Boolean).join(" · ")}</p>

      <section className="card">
        <h2>Grades & missing work</h2>
        {notes.length ? (
          <ul className="list">
            {notes.map((n) => (
              <li key={n.id}>
                <div><span className={`badge ${n.kind === "missing_work" ? "bad" : ""}`}>{n.kind.replace("_", " ")}</span> {n.class_name && <b>{n.class_name}: </b>}{n.text} <span className="muted small">{fmtDate(n.noted_on)}</span></div>
                <Del action={deleteKidRow} id={n.id} extra={{ table: "note" }} />
              </li>
            ))}
          </ul>
        ) : <p className="muted">No notes.</p>}
        <details><summary>Add a note</summary>
          <form action={addKidNote} className="stack">
            <input type="hidden" name="kid_id" value={k.id} />
            <div className="grid2">
              <label>Type<select name="kind"><option value="grade">Grade</option><option value="missing_work">Missing work</option><option value="note">Note</option></select></label>
              <label>Class<input name="class_name" /></label>
            </div>
            <label>Note<input name="text" required /></label>
            <button className="primary">Add</button>
          </form>
        </details>
      </section>

      <section className="card">
        <h2>School lunch (MySchoolBucks)</h2>
        <p>Balance: <b>{balance != null ? fmtMoney(balance) : "unknown"}</b></p>
        {lunch.length > 0 && (
          <div className="table-wrap"><table>
            <thead><tr><th>Date</th><th>What</th><th>Amount</th><th>Balance</th><th></th></tr></thead>
            <tbody>{lunch.map((l) => (
              <tr key={l.id}><td>{fmtDate(l.occurred_on)}</td><td>{l.description}</td><td>{fmtMoney(l.amount)}</td><td>{fmtMoney(l.balance_after)}</td>
                <td><Del action={deleteKidRow} id={l.id} extra={{ table: "lunch" }} /></td></tr>
            ))}</tbody>
          </table></div>
        )}
        <details><summary>Add a transaction</summary>
          <form action={addLunch} className="stack">
            <input type="hidden" name="kid_id" value={k.id} />
            <div className="grid2">
              <label>Date<input type="date" name="occurred_on" /></label>
              <label>What<input name="description" placeholder="Lunch, deposit…" /></label>
              <label>Amount (− for charges)<input name="amount" inputMode="decimal" /></label>
              <label>Balance after<input name="balance_after" inputMode="decimal" /></label>
            </div>
            <button className="primary">Add</button>
          </form>
        </details>
      </section>

      <section className="card">
        <h2>Upcoming school events</h2>
        {events.length ? (
          <ul className="list">{events.map((e) => (
            <li key={e.id}><div><b>{fmtDate(e.event_date)}</b> {e.title}{e.location && <span className="muted"> · {e.location}</span>}{!e.kid_id && <span className="badge">all kids</span>}</div>
              <Del action={deleteKidRow} id={e.id} extra={{ table: "event" }} /></li>
          ))}</ul>
        ) : <p className="muted">Nothing coming up.</p>}
        <details><summary>Add an event</summary>
          <form action={addSchoolEvent} className="stack">
            <input type="hidden" name="kid_id" value={k.id} />
            <div className="grid2">
              <label>What<input name="title" required /></label>
              <label>Date<input type="date" name="event_date" /></label>
              <label>Where<input name="location" /></label>
            </div>
            <button className="primary">Add</button>
          </form>
        </details>
      </section>
    </div>
  );
}
