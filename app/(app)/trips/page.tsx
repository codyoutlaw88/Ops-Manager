import { db } from "@/lib/db";
import { fmtDate } from "@/lib/time";
import { saveTrip, deleteTrip } from "../../actions";
import { Del } from "@/components/ui";

function Fields({ t }: { t?: Record<string, unknown> }) {
  const v = (k: string) => (t?.[k] as string | null | undefined) ?? "";
  const d = (k: string) => (t?.[k] ? new Date(t[k] as string).toISOString().slice(0, 10) : "");
  return (
    <div className="grid2">
      <label>Type<select name="kind" defaultValue={v("kind") || "trip"}><option value="trip">Trip</option><option value="birthday">Birthday</option><option value="event">Event</option></select></label>
      <label>What<input name="title" defaultValue={v("title")} required /></label>
      <label>Start<input type="date" name="start_date" defaultValue={d("start_date")} /></label>
      <label>End<input type="date" name="end_date" defaultValue={d("end_date")} /></label>
      <label>Who&apos;s going<input name="people" defaultValue={v("people")} /></label>
      <label>Notes<input name="notes" defaultValue={v("notes")} /></label>
    </div>
  );
}

export default async function Trips() {
  const rows = await db()`select * from trips_events where start_date is null or coalesce(end_date, start_date) >= current_date - 1 order by start_date nulls last`;
  return (
    <div className="stack">
      <h1>Trips & birthdays</h1>
      <ul className="list">
        {rows.map((t) => (
          <li key={t.id}>
            <details className="grow">
              <summary>
                <span className="badge">{t.kind}</span> <b>{fmtDate(t.start_date)}{t.end_date && ` – ${fmtDate(t.end_date)}`}</b> {t.title}
                {(t.people || t.notes) && <div className="muted small">{[t.people && `Going: ${t.people}`, t.notes].filter(Boolean).join(" · ")}</div>}
              </summary>
              <form action={saveTrip} className="stack"><input type="hidden" name="id" value={t.id} /><Fields t={t} /><button className="primary">Save</button></form>
              <Del action={deleteTrip} id={t.id} />
            </details>
          </li>
        ))}
      </ul>
      {!rows.length && <p className="muted">Nothing coming up.</p>}
      <details className="card"><summary>Add a trip or birthday</summary>
        <form action={saveTrip} className="stack"><Fields /><button className="primary">Add</button></form>
      </details>
    </div>
  );
}
