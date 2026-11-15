import { redirect } from "next/navigation";
import { passwordMatches, startSession, isSignedIn } from "@/lib/auth";

async function login(form: FormData) {
  "use server";
  const pw = String(form.get("password") || "");
  if (!passwordMatches(pw)) {
    await new Promise((r) => setTimeout(r, 1500));
    redirect("/login?bad=1");
  }
  await startSession();
  redirect("/");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ bad?: string }> }) {
  if (await isSignedIn()) redirect("/");
  const { bad } = await searchParams;
  return (
    <main className="login">
      <h1>Ops Manager</h1>
      <form action={login} className="card stack">
        <label>Password<input type="password" name="password" autoComplete="current-password" required autoFocus /></label>
        {bad && <p className="warn">That password didn't match.</p>}
        <button className="primary">Sign in</button>
      </form>
    </main>
  );
}
