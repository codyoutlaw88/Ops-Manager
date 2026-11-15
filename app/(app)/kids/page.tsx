import Link from "next/link";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/time";

export default async function Kids() {
  const kids = await db()`
    select k.*, (select balance_after from lunch_transactions l where l.kid_id = k.id and balance_after is not null order by occurred_on desc, id desc limit 1) as balance,
      (select count(*)::int from kid_notes n where n.kid_id = k.id and n.kind = 'missing_work' and n.noted_on > current_date - 14) as missing
    from kids k order by k.id`;
  return (
    <div className="stack">
      <h1>Kids</h1>
      {kids.map((k) => (
        <Link key={k.id} href={`/kids/${k.name}`} className="card kid">
          <h2>{k.name}</h2>
          <p className="muted">{[k.grade && `${k.grade} grade`, k.school].filter(Boolean).join(", ")}</p>
          <p>Lunch balance: {k.balance != null ? fmtMoney(k.balance) : "unknown"}{k.missing ? ` · ${k.missing} missing-work note(s) in 2 weeks` : ""}</p>
        </Link>
      ))}
    </div>
  );
}
