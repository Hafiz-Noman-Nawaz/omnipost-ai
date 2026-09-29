# OmniPost Agent — Architecture & Stack Proposal (Phase 0, Doc 1/5)

> Status: **Proposal — awaiting founder review.** No production code written.
> Scope note from founder: *personal/internal product first, multi-tenant-ready, and explicitly
> NOT paywall-gated — all capabilities unlocked for the single owner user. Plan/limit fields
> exist as inert columns so a future SaaS can activate them without a migration.*

---

## 1. What we are building

A personal, production-oriented social media automation platform ("internal SaaS") that:

1. Stores content (Content Vault) and organizes it into campaigns.
2. Uses an LLM to generate platform-specific captions/hashtags/hooks (never blindly cross-posted).
3. Requires human approval before anything is published (approval is the default, not an option).
4. Publishes via official platform APIs through a queue + worker (no frontend timers, no browser automation, no stored passwords).
5. Monitors comments, classifies intent, suggests/auto-sends replies only within strict safety rules, escalates everything sensitive to the human.
6. Tracks analytics only where APIs actually provide them, and says "unavailable" when they don't.
7. Is driven from one dashboard plus a natural-language agent chat that can only act through a whitelisted, permission-classified tool layer.

**Non-goals for v1:** billing, multi-org UI, marketing site, more than one user. These are *shaped for*, not built.

---

## 2. Recommended stack (and why)

| Layer | Choice | Rationale |
|---|---|---|
| Language | **TypeScript everywhere** | One language across web/api/worker; single dev can hold the whole system in their head. |
| Monorepo | **npm workspaces** (no Nx/Turbo yet) | Node 24 + npm 11 are the only tools verified on this machine. pnpm can be swapped in later without architectural impact. |
| Web app | **Next.js 15 (App Router) + TailwindCSS + shadcn/ui** | Dashboard-first product; React Server Components keep the client light; huge ecosystem; easy auth integration. |
| API | **Next.js Route Handlers** for v1 | Same process, same types, same deploy. The API surface is cleanly separated in code (`apps/api`-style route modules under `src/app/api`) so extracting a standalone API service later is a move, not a rewrite. |
| Database | **PostgreSQL 16** | The only sane choice for relational multi-tenant data, JSONB metadata, and `SELECT … FOR UPDATE SKIP LOCKED` queue semantics. |
| ORM | **Prisma** | Typed schema-as-code, migrations, good Postgres support. Schema is the single source of truth for docs/02. |
| Queue | **pg-boss on Postgres** initially | v1 must not require a second stateful service. pg-boss gives retries, exponential backoff, cron, and dead-letter — backed by the same Postgres. The `Queue` interface in `packages/queue` is thin; a **BullMQ/Redis adapter** slots in later when throughput justifies it. |
| Worker | **Separate Node process** (`apps/worker`) | Publishes, polls post status, collects comments/analytics. Independent restarts; crash-safe. |
| Auth | **Auth.js (NextAuth v5)** — credentials (argon2id-hashed) + email magic link; OAuth-ready | Session in DB (JWT not required); middleware guards dashboard routes. Social platform OAuth is *separate* (see §6). |
| Validation | **Zod** | One schema language shared by API routes, tools, worker jobs, and env parsing. |
| AI | **Vercel AI SDK** behind our own `LLMProvider` port | Built-in tool-calling loop, streaming, provider adapters (OpenAI/Anthropic/Gemini/DeepSeek community adapters). We keep our own interface so the SDK itself is replaceable. Default model: **Anthropic Claude** (strong instruction-following for safety-critical classification); OpenAI as fallback. |
| Tokens/crypto | **AES-256-GCM via Node `crypto`**, key from `TOKEN_ENCRYPTION_KEY` | Platform OAuth tokens encrypted at rest (§ Security doc). |
| Media storage | **Local disk (`.data/uploads`) with a `StorageAdapter` port** | Personal v1 runs on one box. S3/R2 adapter later — Content rows store `storageKey`, never absolute paths. |
| Observability | **pino** structured JSON logs + correlation IDs | `organizationId/campaignId/contentId/scheduledPostId/jobId/agentExecutionId` on every log line (spec §43). |
| Testing | **Vitest** (unit + integration) | Fast, ESM-native, workspaces-friendly. Playwright deferred until UI stabilizes. |

**Explicitly rejected for v1:** Redis dependency (pg-boss suffices), microservices (one dev, one box), browser-automation publishing (forbidden by spec §2), tRPC (REST + Zod is enough and SaaS-friendly).

---

## 3. System architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ Browser — Next.js Dashboard (apps/web)                       │
│  Content · Campaigns · Calendar · Approvals · Comments ·     │
│  Analytics · Accounts · Automation · Response Library ·      │
│  Agent Chat · Settings                                       │
└───────────────▲──────────────────────────────────────────────┘
                │ HTTPS (session cookie)
┌───────────────┴──────────────────────────────────────────────┐
│ Next.js server (apps/web)                                    │
│  ├─ /api/rest/*        REST endpoints (Zod-validated)        │
│  ├─ /api/agent/*       agent chat → ToolRunner               │
│  └─ Auth.js            sessions, RBAC                         │
│        │                                                     │
│        ▼                                                     │
│  packages/* (same code used by worker)                       │
│   ├─ database  Prisma client + repos                         │
│   ├─ auth      session/RBAC helpers                          │
│   ├─ ai        LLMProvider port + adapters + ToolRunner      │
│   ├─ prompts   versioned prompt registry                     │
│   ├─ tools     tool catalog, permission gate, guards         │
│   ├─ providers SocialProvider port + platform adapters       │
│   ├─ queue     Queue port + pg-boss adapter                  │
│   ├─ media     StorageAdapter + (future) processing          │
│   └─ shared    zod schemas, errors, types, safety classifier │
└───────────────┬─────────────────────────────────▲────────────┘
                │ enqueue jobs                    │ read/write
┌───────────────▼─────────────────┐   ┌───────────┴────────────┐
│ PostgreSQL 16                   │   │ Worker (apps/worker)   │
│  tenant tables · audit · tokens │   │ publish · poll status  │
│  queue (pg-boss schema)         │◄──┤ comments · analytics   │
└─────────────────────────────────┘   │ daily report           │
                                      └───────────┬────────────┘
                                                  │ official OAuth APIs only
                            ┌─────────────────────┼─────────────────────┐
                            ▼                     ▼                     ▼
                      Instagram Graph        LinkedIn REST           TikTok / X / FB
                      (provider adapter)     (provider adapter)      (added per phase)
```

Key rule: **only the worker and explicitly-invoked server tools ever talk to platform APIs**, and only with tokens decrypted in-memory inside the provider adapter. The LLM sees tool *results*, never credentials.

---

## 4. Folder structure

```text
omnipost/
├── apps/
│   ├── web/                      # Next.js 15 dashboard + REST route handlers
│   │   ├── src/app/
│   │   │   ├── (auth)/login, register
│   │   │   ├── (dashboard)/
│   │   │   │   ├── page.tsx                 # Dashboard home (widgets)
│   │   │   │   ├── content/                 # Content Vault (upload, library)
│   │   │   │   ├── campaigns/
│   │   │   │   ├── calendar/
│   │   │   │   ├── approvals/
│   │   │   │   ├── comments/
│   │   │   │   ├── analytics/
│   │   │   │   ├── accounts/                # Connected Accounts
│   │   │   │   ├── automation/              # rules + toggles
│   │   │   │   ├── responses/               # Response Library
│   │   │   │   ├── agent/                   # AI Agent chat
│   │   │   │   └── settings/
│   │   │   └── api/
│   │   │       ├── auth/[...nextauth]/
│   │   │       ├── rest/                    # versioned REST endpoints
│   │   │       │   ├── content/ campaigns/ posts/ approvals/
│   │   │       │   ├── comments/ analytics/ accounts/
│   │   │       │   ├── responses/ rules/ notifications/
│   │   │       │   └── agent/
│   │   │       └── oauth/[platform]/callback/   # platform OAuth redirects
│   │   └── src/lib/              # server-only helpers (session, rbac, audit)
│   └── worker/
│       └── src/
│           ├── index.ts          # boot, queue subscriptions
│           ├── jobs/             # publish-post, poll-post-status,
│           │                     # sync-comments, sync-analytics, daily-report
│           └── cron.ts
├── packages/
│   ├── database/                 # prisma schema, migrations, client, repos
│   ├── auth/                     # session utils, RBAC, password hashing
│   ├── ai/                       # LLMProvider port + adapters, agent runner
│   ├── prompts/                  # versioned prompt registry (see Doc 4)
│   ├── tools/                    # tool catalog + PermissionGate + guards
│   ├── providers/                # SocialProvider port + platform adapters
│   ├── queue/                    # Queue port + pg-boss adapter + job payloads
│   ├── media/                    # StorageAdapter (local/S3) + processing stubs
│   └── shared/                   # zod schemas, enums, errors, safety, logger
├── docs/                         # these planning docs + ADRs + phase notes
├── tests/
│   ├── unit/
│   ├── integration/
│   └── agent/                    # tool-selection & injection-defense suites
├── .env.example
├── docker-compose.yml            # postgres only (v1)
├── package.json                  # npm workspaces
└── tsconfig.base.json
```

---

## 5. Ports & adapters (the seams that matter)

| Port (interface) | v1 Adapter | Future adapters |
|---|---|---|
| `LLMProvider` | Vercel AI SDK → Claude/OpenAI | Gemini, DeepSeek |
| `SocialProvider` | Instagram, then LinkedIn | Facebook, TikTok, X, YouTube |
| `Queue` | pg-boss | BullMQ/Redis |
| `StorageAdapter` | local disk | S3 / Cloudflare R2 |
| `MediaProcessor` | pass-through | sharp/ffmpeg pipelines |
| `Notifier` | in-app Notification table | Email, Discord, Telegram, WhatsApp |
| `PlanLimits` | always-unlimited policy (founder's requirement) | real per-plan limits for SaaS |

Every port lives in its package with **no imports from apps**, so apps and worker depend only on ports + chosen adapters. This is what keeps the SaaS conversion a configuration exercise rather than a rewrite.

---

## 6. Multi-tenancy & the "no paid-tier gating" decision

- Every tenant-owned table carries `organizationId`; every query path goes through repo helpers that require an organization scope (enforced in code review + integration tests, documented in Doc 5 security model).
- Founder's directive implemented as: the default organization's `PlanLimits` row is **all-unlimited** and every limit check funnels through a single `assertWithinLimits()` function that is a no-op when `unlimited: true`. Billing/plan UI is not built. When SaaS arrives, limits activate by changing data, not code structure.
- Roles (`Owner/Admin/Editor/Viewer`) exist in the schema and in RBAC middleware; the single founder user is `Owner` of the default org. No role-assignment UI in v1.

---

## 7. Concurrency & reliability model

- **Publish path:** Scheduler row `Queued → Processing` is claimed transactionally (`UPDATE … WHERE status='Queued'` + `FOR UPDATE SKIP LOCKED` via pg-boss job); `attempts`, `lastAttemptAt`, `error` maintained; exponential backoff retries (max 5); `Failed` after exhaustion with structured error code (spec §27).
- **Idempotency:** every publish job carries an idempotency key = `scheduledPostId`; provider adapters refuse a second create for the same key; `platformPostId` written in the same transaction as status flip to `Published`. Worker restarts can never double-post.
- **Token lifecycle:** refresh proactively at 80% of expiry during status polls; expired-connection creates a Notification and pauses affected scheduled posts rather than failing them one by one.
- **Clock:** all scheduling stored as UTC instants + original IANA timezone; rendering in campaign/user timezone in UI.

---

## 8. Key decisions log (ADR summary — full ADRs live in docs/adr/)

| # | Decision | Why | Alternative rejected |
|---|---|---|---|
| 001 | Postgres as queue backing (pg-boss) | one fewer stateful service for single-dev v1 | Redis+BullMQ from day 1 |
| 002 | Next.js route handlers as "API app" for v1 | same types/process; extract later | separate Express/Fastify service now |
| 003 | Tokens AES-256-GCM at rest; key from env/KMS | spec §28 | storing plaintext "because personal" |
| 004 | Agent = tool-calling loop over whitelisted catalog | spec §14/§15 | giving model free-form DB/API access |
| 005 | Anthropic as default LLM | classification discipline for safety paths | GPT-only coupling |
| 006 | Limits exist but default unlimited | founder: personal product, no paywalls now | building billing now |
| 007 | Provider capability matrix in DB, surfaced in UI | spec §4 "do not assume capabilities" | per-platform if/else in UI |

---

## 9. Environment variables (summary — full spec in Doc 5)

`DATABASE_URL`, `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY` (32-byte base64), `APP_URL`,
`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, `INSTAGRAM_APP_ID/SECRET`, `LINKEDIN_CLIENT_ID/SECRET`,
`WORKER_CONCURRENCY`, `LOG_LEVEL`, `NODE_ENV`. Provider keys optional until their phase lands.

---

## 10. What Phase 1 delivers (preview — full roadmap in Doc 5)

Auth (register/login/session), default Organization + Membership, dashboard shell with the 12-item nav, settings page, audit-log foundation, env validation, docker-compose Postgres, health endpoint, and tests. Nothing platform-connected yet.

---

*Next doc: `02-database-schema.md` — ERD + full Prisma schema.*
