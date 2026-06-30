import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Issue Routing",
  description: "LLM-powered issue triage with RBAC, SLA tracking, and real-time dashboards.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
