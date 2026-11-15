import { db } from "@/lib/db";
import { chicagoToday, toIso } from "@/lib/time";
import { openItemLine } from "@/job/rundown";
import { addOpenItem, setOpenItemStatus, deleteOpenItem } from "../../actions";
import { Del } from "@/components/ui";

const KINDS = ["bill", "shutoff", "locked_card", "settlement", "package", "trip", "birthday", "appointment", "other"];

export default async function Items() {
  const today = chicagoToday();
  const rows = await db()`select id, kind, title, detail, amount, due_date, status from open_items
    where status = 'open' or done_at > now() - interval '14 days' order by status desc, due_date nulls last, id`;
  return (
    <div className="stack">
      <h1>Open items</h1>
      <p className="muted">These carry into every rundown until you mark them done. Money items stay &quot;unconfirmed&quot; until you check the biller&apos;s or bank&apos;s site.</p>
      <ul className="list">
        {rows.map((o) => {
          const late = o.status === "open" && toIso(o.due_date) && toIso(o.due_date)! < today;
          return (
            <li key={o.id} className={o.status === "done" ? "done" : late ? "late" : ""}>
              <div>
                <span className="badge">{o.kind.replace("_", " ")}</span> {openItemLine(o as never, today)}
                {o.detail && <div className="muted small">{o.detail}</div>}
              </div>
              <div className="row">
                <form action={setOpenItemStatus} className="inline">
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="status" value={o.status === "open" ? "done" : "open"} />
                  <button className="small">{o.status === "open" ? "Mark done" : "Reopen"}</button>
                </form>
                <Del action={deleteOpenItem} id={o.id} />
              </div>
            </li>
          );
        })}
      </ul>
      {!rows.length && <p className="muted">No open items.</p>}
      <details className="card">
        <summary>Add an item</summary>
        <form action={addOpenItem} className="stack">
          <label>What<input name="title" required /></label>
          <div className="grid2">
            <label>Type<select name="kind">{KINDS.map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}</select></label>
            <label>Due / date<input type="date" name="due_date" /></label>
            <label>Amount<input name="amount" inputMode="decimal" /></label>
          </div>
          <label>Notes<input name="detail" /></label>
          <button className="primary">Add</button>
        </form>
      </details>
    </div>
  );
}
