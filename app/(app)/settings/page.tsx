import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";
import { addFilter, removeFilter, saveSecret, deleteSecret } from "../../actions";
import { Del } from "@/components/ui";
import PushSetup from "@/components/PushSetup";

export default async function Settings() {
  const sql = db();
  const [filters, secrets, runs] = await Promise.all([
    sql`select * from filters order by kind, pattern`,
    sql`select name, updated_at from secrets order by name`,
    sql`select * from runs order by id desc limit 10`,
  ]);
  return (
    <div className="stack">
      <h1>Settings</h1>

      <section className="card">
        <h2>Notifications</h2>
        <p className="muted">On iPhone: open this site in Safari, tap Share, then Add to Home Screen. Open it from the home screen icon, then turn on notifications here.</p>
        <PushSetup publicKey={process.env.VAPID_PUBLIC_KEY || ""} />
      </section>

      <section className="card">
        <h2>Recent mail checks</h2>
        <ul className="small-list">
          {runs.map((r) => (
            <li key={r.id}>
              <span className={`badge ${r.status === "ok" ? "ok" : r.status === "failed" ? "bad" : ""}`}>{r.status}</span> {fmtDateTime(r.started_at)} ({r.slot}) · {r.read_count} read, {r.skipped_count} skipped
              {r.error && <div className="warn small">{r.error}</div>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Skip list</h2>
        <p className="muted">Mail matching these is skipped before any AI step (free). Promos are also caught by the AI step.</p>
        <ul className="small-list">
          {filters.map((f) => (
            <li key={f.id}><span className="badge">{f.kind.replace("_", " ")}</span> {f.pattern} <span className="muted">({f.reason})</span> <Del action={removeFilter} id={f.id} /></li>
          ))}
        </ul>
        <form action={addFilter} className="row wrap">
          <select name="kind"><option value="sender_domain">Sender domain</option><option value="sender_contains">Sender contains</option><option value="subject_contains">Subject contains</option></select>
          <input name="pattern" placeholder="e.g. planhub.com" required />
          <select name="reason"><option value="promo">promo</option><option value="bid_invite">bid invite</option></select>
          <button className="small">Add</button>
        </form>
      </section>

      <section className="card">
        <h2>Saved logins (encrypted)</h2>
        <p className="muted">Stored with AES-256 encryption and never shown again. Your Yahoo app password does not go here; it lives in GitHub Secrets.</p>
        <ul className="small-list">
          {secrets.map((s) => (
            <li key={s.name}>{s.name} <span className="muted">saved {fmtDateTime(s.updated_at)}</span>
              <form action={deleteSecret} className="inline"><input type="hidden" name="name" value={s.name} /><button className="link danger">Delete</button></form></li>
          ))}
        </ul>
        <form action={saveSecret} className="row wrap">
          <input name="name" placeholder="Name, e.g. MySchoolBucks" required />
          <input name="value" type="password" placeholder="Password" required autoComplete="off" />
          <button className="small">Save</button>
        </form>
      </section>
    </div>
  );
}
