import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

function make() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, {
    onnotice: () => {},
    prepare: false, // required for Supabase's transaction pooler
    max: 3,
    idle_timeout: 20,
    types: { numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) } },
  });
}

export function db() {
  if (!globalThis.__sql) globalThis.__sql = make();
  return globalThis.__sql;
}
