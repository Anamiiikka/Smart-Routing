import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Smart Issue Routing</h1>
        <p className="mt-2 text-muted-foreground">
          LLM-powered issue triage with role-based access control, SLA tracking, priority
          handling, and real-time dashboards.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Sign in
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium"
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
