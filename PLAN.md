# Smart Issue Routing System — Implementation Plan

> LLM-powered ticket triage with RBAC, SLA tracking, priority handling, and real-time dashboards.
> **Stack:** Next.js (App Router) · TypeScript · Node.js · Prisma · Neon Postgres · OpenAI
> **Target:** Production-grade

---

## 1. Goals (mapped to the resume claims)

| Resume claim | How the build delivers it |
|---|---|
| "LLM-powered issue routing… reducing manual triage by 90%" | On ticket creation, an async worker calls OpenAI with structured output to classify **category + priority + suggested team**, with a confidence score and rationale. High-confidence routes auto-assign; low-confidence falls back to a human queue. |
| "scalable backend services" | Stateless Next.js API routes + a separate **pg-boss** (Postgres-backed) worker process for async/retryable jobs. No Redis dependency; horizontally scalable. |
| "reducing response latency" | Async routing (request returns immediately), SLA-driven prioritization, and metrics tracking time-to-first-response. |
| "Role-Based Access Control (RBAC)" | Auth.js (NextAuth v5) credentials auth + roles (ADMIN / MANAGER / AGENT / REQUESTER), enforced in middleware **and** per-action server checks via a permission matrix. |
| "SLA tracking" | Per-category SLA policies × priority multipliers → response/resolution due dates; a scheduled job flags breaches. |
| "priority handling" | Priority enum drives queue ordering, SLA windows, and dashboard sorting. |
| "real-time dashboards to monitor resolution times and system health" | SSE-pushed metrics: tickets by status/priority, SLA breaches, avg resolution time, **plus system health** (queue depth, LLM latency, error rate). |

---

## 2. Architecture

```
Next.js App (Vercel)
├─ App Router pages (dashboards, ticket views, auth)
├─ Route Handlers (REST-ish API)            ── Prisma ──┐
├─ Auth.js (sessions, JWT w/ role claim)                │
└─ SSE endpoint (/api/stream/metrics)                   ▼
                                                  Neon Postgres
Worker process (Railway/Render)                         ▲
├─ pg-boss queue (jobs table in Postgres) ──────────────┤
├─ routeTicket job  → OpenAI structured output ─────────┘
└─ slaSweep cron job → flag breaches
```

- **LLM access is behind a `RoutingProvider` interface** (`OpenAIProvider`, `MockProvider`) so it's swappable and testable without an API key.
- Worker and web share the Prisma client and `lib/` core; deployed separately but one repo.

---

## 3. Data model (Prisma)

- `User` — email, name, passwordHash, `role` (enum), `teamId?`
- `Team` — name, members
- `Category` — name, `slaResponseMins`, `slaResolutionMins`, default team
- `Ticket` — title, description, `status` (NEW→TRIAGED→ASSIGNED→IN_PROGRESS→RESOLVED→CLOSED), `priority` (LOW/MEDIUM/HIGH/URGENT), categoryId?, assigneeId?, teamId?, requesterId, `responseDueAt?`, `resolutionDueAt?`, `firstResponseAt?`, `resolvedAt?`, breach flags
- `RoutingDecision` — ticketId, model, suggested category/priority/team, confidence, rationale, latencyMs, tokensUsed, createdAt
- `Comment` — ticketId, authorId, body
- `AuditLog` — actor, action, entity, diff, createdAt
- `SystemMetricSnapshot` — periodic queue depth / LLM latency / error rate for health dashboard

---

## 4. Build phases

1. **Scaffold & tooling** — Next.js + TS + Tailwind + shadcn/ui, ESLint/Prettier, env handling (`zod`-validated), folder structure.
2. **Database** — provision Neon project + branch, Prisma schema, migrations, seed script (users for each role, teams, categories, demo tickets).
3. **Auth & RBAC** — Auth.js credentials, role claim in session, middleware route guards, `can(role, action, resource)` permission matrix, server-side enforcement helpers.
4. **Tickets API + UI** — CRUD route handlers with RBAC + zod validation, requester submit form, agent/manager list & detail views, comments, status transitions with audit logging.
5. **LLM routing** — `RoutingProvider` interface, `OpenAIProvider` using structured/function-calling output, `MockProvider`; `routeTicket` pg-boss job (enqueue on create, retries, confidence threshold → auto-assign vs human queue); persist `RoutingDecision`.
6. **SLA engine** — compute due dates on triage, `slaSweep` scheduled job to flag breaches, priority-aware ordering.
7. **Dashboards & real-time** — metrics aggregation queries, SSE endpoint, dashboard with status/priority breakdown, SLA breaches, avg resolution time, and **system health** panel; role-scoped views.
8. **Quality & ops** — Vitest unit tests (routing, RBAC, SLA math), Playwright e2e (submit→route→assign→resolve), GitHub Actions CI, pino structured logging, `/api/health`, optional Sentry, README + deploy notes for Vercel + worker host.

---

## 5. Key decisions

- **Queue:** pg-boss (Postgres-backed) over BullMQ/Redis — fits Neon, one less service.
- **Real-time:** native SSE over Pusher/Ably — self-contained, no third-party.
- **LLM:** OpenAI via swappable provider; deterministic mock keeps tests/CI key-free.
- **Auth:** Auth.js credentials for a self-contained demo; OAuth providers can be added later.

---

## 6. Deliverables

- Running app (`npm run dev`) with seeded multi-role demo data and a one-command demo login.
- Worker process for routing + SLA jobs.
- Tests + green CI.
- README with setup, env vars, architecture diagram, and demo script.
