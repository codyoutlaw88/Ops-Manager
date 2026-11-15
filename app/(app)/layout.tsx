import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { signOut } from "../actions";

const NAV = [
  ["/", "Today"], ["/items", "Open items"], ["/bills", "Bills"], ["/declines", "Declines"], ["/kids", "Kids"],
  ["/jobs", "Jobs"], ["/trips", "Trips"], ["/rundowns", "History"], ["/settings", "Settings"],
];

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <>
      <header className="top">
        <strong>Ops Manager</strong>
        <form action={signOut}><button className="link">Sign out</button></form>
      </header>
      <nav className="tabs">
        {NAV.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
      <main>{children}</main>
    </>
  );
}
