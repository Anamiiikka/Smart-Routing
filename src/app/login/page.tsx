"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { authenticate } from "@/app/actions/auth";

const DEMO_ACCOUNTS = [
  { email: "admin@example.com", role: "Admin" },
  { email: "manager@example.com", role: "Manager" },
  { email: "agent1@example.com", role: "Agent" },
  { email: "requester@example.com", role: "Requester" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const [error, formAction] = useActionState(authenticate, undefined);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Smart Issue Routing console
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <label className="text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            required
            defaultValue="admin@example.com"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium">
          Password
          <input
            name="password"
            type="password"
            required
            defaultValue="Password123!"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <SubmitButton />
      </form>

      <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">Demo accounts (password: Password123!)</p>
        <ul className="space-y-0.5">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <span className="font-mono">{a.email}</span> — {a.role}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
