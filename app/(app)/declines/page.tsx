import { db } from "@/lib/db";
import { fmtMoney, fmtDateTime } from "@/lib/time";
import { addDecline, deleteDecline } from "../../actions";
import { Del } from "@/components/ui";

export default async function Declines() {
  const rows = await db()`select * from card_declines order by occurred_at desc nulls last limit 200`;
  return (
    <div className="stack">
      <h1>Card declines</h1>
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Merchant</th><th>Amount</th><th>Card</th><th></th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{fmtDateTime(d.occurred_at)}</td>
                <td>{d.merchant}{d.notes && <div className="muted small">{d.notes}</div>}</td>
                <td>{fmtMoney(d.amount)}</td>
                <td>{d.card_last4 ? `…${d.card_last4}` : ""}</td>
                <td><Del action={deleteDecline} id={d.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="muted">No declines logged.</p>}
      <details className="card">
        <summary>Log a decline</summary>
        <form action={addDecline} className="stack">
          <div className="grid2">
            <label>Merchant<input name="merchant" required /></label>
            <label>Amount<input name="amount" inputMode="decimal" /></label>
            <label>When<input type="datetime-local" name="occurred_at" /></label>
            <label>Card last 4<input name="card_last4" maxLength={4} inputMode="numeric" /></label>
          </div>
          <button className="primary">Add</button>
        </form>
      </details>
    </div>
  );
}
