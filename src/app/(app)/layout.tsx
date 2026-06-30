import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { logout } from "@/app/actions/auth";
import { Badge } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const nav = [
    { href: "/dashboard", label: "Dashboard", show: can(user.role, "dashboard.view") },
    { href: "/tickets", label: "Tickets", show: true },
    { href: "/tickets/new", label: "New ticket", show: can(user.role, "ticket.create") },
  ].filter((n) => n.show);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold">
              Smart Issue Routing
            </Link>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-foreground">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{user.name}</span>
            <Badge className="border-border">{user.role}</Badge>
            <form action={logout}>
              <button className="text-muted-foreground hover:text-foreground">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
