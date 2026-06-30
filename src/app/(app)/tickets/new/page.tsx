"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewTicketPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        description: form.get("description"),
      }),
    });

    if (res.ok) {
      const { ticket } = await res.json();
      router.push(`/tickets/${ticket.id}`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create ticket");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">New ticket</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Describe the issue. It will be auto-triaged, prioritised, and routed by the AI assistant.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="text-sm font-medium">
          Title
          <input
            name="title"
            required
            minLength={3}
            placeholder="Short summary of the issue"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium">
          Description
          <textarea
            name="description"
            required
            minLength={5}
            rows={6}
            placeholder="What happened? Steps to reproduce, error messages, impact…"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit ticket"}
        </button>
      </form>
    </div>
  );
}
