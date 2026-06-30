# Smart Issue Routing System

An LLM-powered issue/ticket triage platform with role-based access control, SLA
tracking, priority handling, and real-time dashboards.

When a ticket is created, an async worker calls an LLM to classify it
(**category + priority + team**), with a confidence score and rationale. Confident
decisions auto-assign to the least-loaded agent on the target team; ambiguous
ones fall into a human triage queue — cutting manual triage dramatically while a
live dashboard tracks resolution times and system health.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **React 19**
- **Prisma** ORM on **Neon Postgres**
- **Auth.js v5** (credentials + JWT) for authentication and RBAC
- **OpenAI** for routing (behind a swappable provider; deterministic mock for keyless dev/CI)
- **pg-boss** (Postgres-backed queue) for async routing + scheduled SLA sweeps
- **Server-Sent Events** for live dashboard updates
- **pino** structured logging · **Vitest** unit tests · **Playwright** e2e · **GitHub Actions** CI

## Architecture

```
Next.js app (web)                          Worker process
├─ Route handlers (REST API)               ├─ pg-boss queue (schema: pgboss)
├─ Auth.js (JWT sessions, role claim)      ├─ route-ticket  → LLM → applyRouting
├─ RBAC middleware + per-action guards     └─ sla-sweep (cron: every minute)
└─ SSE /api/stream/metrics                       │
        │                                        │
        └──────────────► Neon Postgres ◄─────────┘
   pooled URL (DATABASE_URL)        direct URL (DIRECT_URL)
```

- The **web app** uses the *pooled* Neon URL and only *enqueues* jobs.
- The **worker** uses the *direct* (unpooled) URL because pg-boss needs
  LISTEN/NOTIFY + advisory locks, which the pooler doesn't support.

### Key modules

| Path | Responsibility |
|---|---|
| `src/lib/rbac.ts` | Capability matrix + ownership checks (`can`, `canViewTicket`) |
| `src/auth.ts` / `src/auth.config.ts` | Auth.js (DB-backed credentials / edge-safe middleware split) |
| `src/lib/routing/` | `RoutingProvider` interface, `OpenAIRoutingProvider`, `MockRoutingProvider` |
| `src/lib/tickets.ts` | Ticket lifecycle: create, applyRouting, status, assign, comment |
| `src/lib/sla.ts` / `src/lib/sla-sweep.ts` | SLA due-date math + breach sweeper |
| `src/lib/metrics.ts` | Dashboard aggregates + system health |
| `src/worker/` | pg-boss worker entrypoint + job processors |

## Getting started

### 1. Prerequisites
- Node 20+
- A Neon Postgres database (or any Postgres)

### 2. Configure environment
Copy `.env.example` to `.env` and fill in:

```bash
DATABASE_URL=   # pooled Neon URL (…-pooler…), used by the app
DIRECT_URL=     # direct Neon URL (no -pooler), used by migrations + worker
AUTH_SECRET=    # node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
LLM_PROVIDER=   # "openai" | "gemini" | "grok" | "mock"
# Set the key for whichever provider you chose (others can stay empty):
OPENAI_API_KEY= # sk-...        (platform.openai.com)
GEMINI_API_KEY= # AIzaSy...     (aistudio.google.com/apikey)
XAI_API_KEY=    # xai-...        (console.x.ai)
```

If the selected provider's key is missing, routing automatically falls back to
the deterministic **mock** provider (and logs a warning), so the app and CI keep
working without any key.

### 3. Install, migrate, seed
```bash
npm install
npm run db:migrate      # apply Prisma migrations
npm run db:seed         # demo teams, categories, users, tickets
```

### 4. Run (two processes)
```bash
npm run dev             # Next.js app on http://localhost:3000
npm run worker          # pg-boss worker (routing + SLA sweeps)
```

### Demo accounts (password: `Password123!`)
| Email | Role | Can |
|---|---|---|
| admin@example.com | ADMIN | everything |
| manager@example.com | MANAGER | assign, system health, categories |
| agent1@example.com | AGENT | update status, comment, dashboard |
| requester@example.com | REQUESTER | create + comment on own tickets |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js app |
| `npm run worker` | Start the pg-boss worker |
| `npm run build` | Production build (runs `prisma generate`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright e2e (boots a dev server) |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma helpers |
| `npx tsx scripts/smoke-routing.ts` | Route the oldest NEW ticket and print the result |

## How routing works

1. `POST /api/tickets` creates the ticket (status `NEW`) and enqueues a
   `route-ticket` job.
2. The worker loads allowed categories/teams and calls the configured
   `RoutingProvider`.
3. `applyRouting` sets category/priority/team, computes SLA deadlines
   (`category SLA × priority multiplier`), and — if `confidence ≥
   ROUTING_CONFIDENCE_THRESHOLD` — auto-assigns to the least-loaded agent and
   moves the ticket to `ASSIGNED`. Otherwise it goes to `TRIAGED` for a human.
4. A `RoutingDecision` row is always written (including failures), powering the
   LLM latency / error-rate health metrics.

Swap providers by changing `LLM_PROVIDER` (`openai` | `gemini` | `grok` |
`mock`). Gemini and Grok are called through their OpenAI-compatible endpoints, so
all three share one `OpenAICompatibleRoutingProvider`. The mock is fully
deterministic, so tests and CI run without an API key.

## Deployment

- **Web app** → Vercel (or any Node host). Set the env vars above.
- **Worker** → a long-running host (Railway, Render, Fly). Run `npm run worker`.
  Vercel's serverless model isn't suited to a persistent queue worker.
- **Database** → Neon. Use the pooled URL for `DATABASE_URL` and the direct URL
  for `DIRECT_URL`. Run `npm run db:deploy` in your release step.

## Testing

- **Unit** (`npm test`): SLA math, RBAC matrix, status transitions, mock classifier.
- **E2E** (`npm run test:e2e`): login → submit ticket → view; manager dashboard;
  requester redirect. Requires a seeded database.
