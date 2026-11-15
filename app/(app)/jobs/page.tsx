import { db } from "@/lib/db";
import { fmtDate, fmtDateTime } from "@/lib/time";
import { saveRecruiter, deleteRecruiter } from "../../actions";
import { Del } from "@/components/ui";

const STATUSES = ["new", "talking", "applied", "interviewing", "offer", "passed", "closed"];

function Fields({ r }: { r?: Record<string, unknown> }) {
  const v = (k: string) => (r?.[k] as string | null | undefined) ?? "";
  const d = (k: string) => (r?.[k] ? new Date(r[k] as string).toISOString().slice(0, 10) : "");
  return (
    <div className="grid2">
      <label>Recruiter<input name="name" defaultValue={v("name")} /></label>
      <label>Company<input name="company" defaultValue={v("company")} /></label>
      <label>Role<input name="role" defaultValue={v("role")} /></label>
      <label>Pay<input name="pay" defaultValue={v("pay")} /></label>
      <label>Location<input name="location" defaultValue={v("location")} /></label>
      <label>Status<select name="status" defaultValue={v("status") || "new"}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label>Next step<input name="next_step" defaultValue={v("next_step")} /></label>
      <label>Next step date<input type="date" name="next_step_date" defaultValue={d("next_step_date")} /></label>
      <label className="span2">Notes<input name="notes" defaultValue={v("notes")} /></label>
    </div>
  );
}

export default async function Jobs() {
  const rows = await db()`select * from recruiters order by (status in ('passed','closed')), next_step_date nulls last, last_contact desc nulls last`;
  return (
    <div className="stack">
      <h1>Jobs</h1>
      <ul className="list">
        {rows.map((r) => (
          <li key={r.id} className={["passed", "closed"].includes(r.status) ? "done" : ""}>
            <details className="grow">
              <summary>
                <b>{r.company || "Unknown company"}</b> · {r.role || "role?"} <span className="badge">{r.status}</span>
                <div className="muted small">
                  {[r.name, r.pay, r.location].filter(Boolean).join(" · ")}
                  {r.next_step && <> · next: {r.next_step}{r.next_step_date && ` (${fmtDate(r.next_step_date)})`}</>}
                  {r.last_contact && <> · last contact {fmtDateTime(r.last_contact)}</>}
                </div>
              </summary>
              <form action={saveRecruiter} className="stack">
                <input type="hidden" name="id" value={r.id} />
                <Fields r={r} />
                <button className="primary">Save</button>
              </form>
              <Del action={deleteRecruiter} id={r.id} />
            </details>
          </li>
        ))}
      </ul>
      {!rows.length && <p className="muted">No recruiters yet. Recruiter emails get added here automatically.</p>}
      <details className="card">
        <summary>Add a recruiter / job</summary>
        <form action={saveRecruiter} className="stack"><Fields /><button className="primary">Add</button></form>
      </details>
    </div>
  );
}
