import { db } from "@/lib/db";
import { fmtDate, fmtMoney, fmtDateTime } from "@/lib/time";
import { addBill, verifyBill, setAutopay, deleteBill } from "../../actions";
import { Del } from "@/components/ui";

const LABEL: Record<string, string> = { paid: "Paid", due: "Due", past_due: "Past due", unconfirmed: "Unconfirmed" };

export default async function Bills() {
  const rows = await db()`select * from bills order by (status = 'paid'), due_date nulls last, id desc limit 200`;
  return (
    <div className="stack">
      <h1>Bills</h1>
      <p className="muted">Bills found in email are always <b>Unconfirmed</b>. Only you can set Paid, Due or Past due, after you check the biller&apos;s or bank&apos;s site.</p>
      <ul className="list">
        {rows.map((b) => (
          <li key={b.id} className={b.status === "past_due" ? "late" : b.status === "paid" ? "done" : ""}>
            <div>
              <div className="row between">
                <b>{b.biller}</b>
                <span className={`badge s-${b.status}`}>{LABEL[b.status]}</span>
              </div>
              <div>{fmtMoney(b.amount) || "Amount ?"}{b.due_date && <> · due {fmtDate(b.due_date)}</>}</div>
              <div className="muted small">
                <form action={setAutopay} className="inline">
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="autopay" value={b.autopay ? "off" : "on"} />
                  Autopay: <button className="link">{b.autopay == null ? "unknown" : b.autopay ? "on" : "off"}</button>
                </form>
                {b.email_says && b.email_says !== "none" && <> · email says {b.email_says.replace("_", " ")}</>}
                {b.verified_at && <> · you verified {fmtDateTime(b.verified_at)}</>}
              </div>
              {b.notes && <div className="muted small">{b.notes}</div>}
              <details>
                <summary className="link small">Verify status</summary>
                <form action={verifyBill} className="stack verify">
                  <input type="hidden" name="id" value={b.id} />
                  <select name="status" defaultValue="paid">
                    <option value="paid">Paid</option><option value="due">Due</option>
                    <option value="past_due">Past due</option><option value="unconfirmed">Back to unconfirmed</option>
                  </select>
                  <label className="check"><input type="checkbox" name="checked" required /> I checked the biller&apos;s or bank&apos;s site</label>
                  <button className="small">Confirm</button>
                </form>
                <Del action={deleteBill} id={b.id} />
              </details>
            </div>
          </li>
        ))}
      </ul>
      {!rows.length && <p className="muted">No bills yet.</p>}
      <details className="card">
        <summary>Add a bill</summary>
        <form action={addBill} className="stack">
          <div className="grid2">
            <label>Biller<input name="biller" required /></label>
            <label>Amount<input name="amount" inputMode="decimal" /></label>
            <label>Due date<input type="date" name="due_date" /></label>
            <label className="check"><input type="checkbox" name="autopay" /> Autopay on</label>
          </div>
          <label>Notes<input name="notes" /></label>
          <button className="primary">Add</button>
        </form>
      </details>
    </div>
  );
}
