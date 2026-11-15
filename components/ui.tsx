export function RundownView({ r }: { r: { needs_today: string[]; coming_up: string[]; fyi: string[]; failed: boolean; text: string } }) {
  const head = r.failed ? r.text.split("\n\n")[0] : null;
  return (
    <div className="stack">
      {head && <div className="card alert"><pre>{head}</pre></div>}
      <Section title="Needs you today" lines={r.needs_today} tone="today" />
      <Section title="Coming up" lines={r.coming_up} tone="soon" />
      <Section title="FYI" lines={r.fyi} tone="fyi" />
    </div>
  );
}

function Section({ title, lines, tone }: { title: string; lines: string[]; tone: string }) {
  return (
    <section className={`card ${tone}`}>
      <h2>{title}</h2>
      {lines.length ? <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="muted">Nothing</p>}
    </section>
  );
}

export function Del({ action, id, extra }: { action: (f: FormData) => Promise<void>; id: number; extra?: Record<string, string> }) {
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className="link danger" aria-label="Delete">Delete</button>
    </form>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="muted">{children}</p>;
}
