# OmniPost Agent — Security, Testing, Roadmap & Risks (Phase 0, Doc 5/5)

> Status: **Proposal — awaiting founder review.**

---

## 1. Security model (spec §28)

### 1.1 Credential & token handling
- **No social passwords, ever.** Only platform OAuth. App-login passwords hashed with argon2id.
- Platform access/refresh tokens: **AES-256-GCM** ciphertext in `Bytes` columns; key from
  `TOKEN_ENCRYPTION_KEY` (32-byte base64), versioned `v1:<ciphertext>` for future rotation.
- Tokens decrypted **only** inside provider adapters at call time; decrypted values never logged,
  never returned by any API response, never placed in LLM context.
- `.env` for dev; secret manager (Doppler/Vault/cloud) in production. `.env*` in `.gitignore`
  from the first commit; `.env.example` committed as the contract (§3).
- Platform OAuth apps registered with least-scope requests; scope list shown on the
  Connected Accounts page (spec §6).

### 1.2 Application auth & RBAC
- Auth.js v5: credentials (argon2id) + magic-link email; DB sessions; httpOnly, secure, sameSite=lax cookies.
- Middleware protects `/content`, `/campaigns`, … dashboard routes; unauthenticated → `/login`.
- Roles enforced **server-side per endpoint** (Doc 3 §1) and re-checked in the PermissionGate for
  every agent tool call. The founder is `OWNER` of the default org; future SaaS roles already
  exist in schema + middleware (no work needed to activate).

### 1.3 Input handling & abuse resistance
- Every request body/query validated by Zod schemas shared with the frontend.
- Prisma-only data access (no raw SQL string-building).
- Rate limiting: per-user token bucket on mutations (in-memory for v1; Redis later).
- CSRF: sameSite cookies + origin check on state-changing routes.
- Security headers (CSP, HSTS, frame-ancestors) set in `next.config`.
- Uploads: type allowlist, size caps, MIME sniffing, randomized storage keys, no user-controlled paths.

### 1.4 LLM boundary recap (spec §42)
- Model output is *requests*, not commands: only whitelisted tools callable, args Zod-validated,
  org-scope re-checked per call, HIGH_RISK requires human confirmation issued via UI (never by the model).
- External content wrapped as delimited data; injection tripwires + execution flags (Doc 4 §6).

### 1.5 Audit logging (spec §29)
Every mutation, agent execution, tool call (allowed or denied), publish attempt, token event, and
automation action writes an `AuditLog` row (`actor USER/AGENT/WORKER/SYSTEM`, action, resource,
metadata, correlation IDs). Retained indefinitely in v1; API for the Settings → Audit page.

---

## 2. Observability (spec §43)
- pino JSON logs; every line carries `correlationId` plus whichever of
  `organizationId/campaignId/contentId/postId/scheduledPostId/jobId/agentExecutionId` apply.
- Request middleware assigns `req_…` correlation IDs; worker jobs inherit/generate `job_…` IDs.
- `PublishAttempt`, `AgentToolCall`, `AuditLog` are the queryable history when something goes wrong.
- Dev: `docker compose logs` + pretty pino; prod later: any log sink (structured JSON ready).

---

## 3. Environment variable specification (`.env.example` contract)

```bash
# --- Core ---
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://omnipost:omnipost@localhost:5432/omnipost
AUTH_SECRET=               # openssl rand -base64 32
TOKEN_ENCRYPTION_KEY=      # openssl rand -base64 32  (AES-256-GCM key for platform tokens)

# --- AI providers (choose one; both optional until Phase 4) ---
AI_PROVIDER=anthropic      # anthropic | openai
AI_MODEL=claude-sonnet-4-5 # provider-specific model id
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# --- Worker ---
WORKER_CONCURRENCY=5
WORKER_POLL_INTERVAL_MS=1000

# --- Platform OAuth (optional until that platform's phase) ---
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
X_OAUTH2_CLIENT_ID=
X_OAUTH2_CLIENT_SECRET=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=

# --- Storage (v1: local; S3 later) ---
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=./.data/uploads

# --- Observability ---
LOG_LEVEL=info
```

Validation: a Zod env schema parses `process.env` at boot in web + worker; missing required vars
fail fast with a readable message. Provider vars are grouped optional so unrelated phases never
block boot.

---

## 4. Testing strategy (spec §41)

**Levels**
- **Unit (Vitest):** scheduling math (timezone conversions, DST edges), approval state machine,
  rule-priority engine, template variable rendering, capability gating, PermissionGate decisions,
  content-safety regexes, prompt registry.
- **Integration:** Postgres via docker-compose (repos + org-scope isolation tests: user A must never
  read org B), pg-boss queue lifecycle (enqueue → claim → retry → dead-letter), idempotent publish
  (worker restart mid-job cannot double-post), OAuth callback flow with mocked provider, provider
  adapters against recorded HTTP fixtures (no live calls in CI).
- **Agent tests:** fixture conversations asserting correct tool selection; permission refusal for
  VIEWER attempting `schedule_post`; HIGH_RISK confirmation flow; **prompt-injection corpus**
  (spec §42 cases) asserting the gate blocks every path regardless of model behavior; ambiguous
  request → `request_human_approval` instead of guessing; missing data → clarifying question.

**Hard rules**
- CI runs unit + integration on every push; provider live-call tests are manual-only scripts.
- A phase is not done until its tests pass and the app has been run and clicked through (spec §45/§51).

**Fixtures & fakes:** `FakeSocialProvider` and `FakeLLMProvider` implementations live in
`packages/shared/testing` and are used by integration + agent tests so suites are deterministic.

---

## 5. Phase-by-phase plan (spec §46 mapping)

| Phase | Deliverable | Done-when (spec §51 gates) |
|---|---|---|
| **1** | Monorepo scaffolding, Postgres via docker-compose, Prisma + migrations, Auth.js (register/login/session), default org + Owner membership, dashboard shell with 12-item nav, settings page, audit-log foundation, health endpoint, tests | app runs; can register, log in, see dashboard; tests green |
| **2** | Uploads (multipart, drag-drop), Content Vault UI, storage adapter, search/filter/tags, campaign association | bulk upload works; library filterable; media opens |
| **3** | Campaign CRUD, audience/objective/tone/CTA/links/platforms/frequency, pause/resume, brand profiles | campaign lifecycle works end-to-end in UI |
| **4** | LLM abstraction + adapters, prompt registry, caption/variation/hashtag generation, regeneration, safety pre-screen | drafts generated per platform with constraints respected |
| **5** | Approval queue UI, approve/reject/duplicate/bulk, audit entries, preview card (what/where/when/link/media) | nothing can publish without approval |
| **6** | pg-boss queue + worker, scheduler service, timezone-aware scheduling, retries/backoff, idempotency, cancel/manual-retry, failure notifications | worker restart never double-publishes (tested) |
| **7** | **First provider: Instagram** — OAuth, token encryption, Graph publishing flow, status polling, capability matrix in UI | a real post publishes to a real IG professional account |
| **8** | Additional platforms one at a time (LinkedIn → Facebook → TikTok → X → YouTube), each with research → OAuth → provider → tests → docs | per-platform capability notes documented |
| **9** | Comment sync, classification, intents, suggestions UI | comments visible + classified from a real post |
| **10** | Response library, automation rules, safe auto-replies, escalation, master switch | auto-reply respects rules + kill-switch |
| **11** | Metrics sync, analytics dashboard, campaign/platform rollups, AI summaries | analytics show Available/Unavailable honestly |
| **12** | Agent chat UI + ToolRunner wiring all tools, confirmation cards, daily AI report | natural-language requests execute through gated tools |

Between phases: run the app, test manually, fix, document in `docs/phases/phase-N.md`.

---

## 6. Risks & platform API limitations (researched Sept 2026 — re-verify at each provider phase)

| Risk | Impact | Mitigation |
|---|---|---|
| **Meta App Review** required for Instagram/Facebook publishing scopes | blocks live publishing until approved | personal-mode dev: use your own accounts in the app's developer role (works without review); submit review when going multi-user |
| **Instagram 100 API posts / 24h** rolling cap | large schedules throttled | scheduler spreads posts; conflict detection; UI warns when cap projected |
| **TikTok unaudited client → private posts** + audit requirement | public posting blocked until audit passes | Phase 8 plan accounts for audit submission (mockups + screen recording); until then posts are test-private, clearly labeled in UI |
| **X pay-per-use pricing** (~$0.015/post, links cost more, reads billed) | unexpected spend | per-platform cost estimate shown before publish; spending cap configured in X developer portal |
| **LinkedIn comment APIs restricted** for member-post comments | comment intelligence partial on LinkedIn | capability matrix marks it; UI shows "unavailable" rather than faking |
| **Token expiry/revocation** | failed publishes | proactive refresh at 80% lifetime; expired → notifications + affected posts paused, not failed |
| **Rate limits per platform** | 429s | adapter-level backoff respecting platform headers; queue-level retries |
| **LLM hallucinated claims (prices/specs)** | credibility/compliance (spec §37) | guardrail prompt + ban-list + human approval always on for publish |
| **Single-dev bus factor** | velocity | docs/ADRs, boring tech, heavy tests, everything in TypeScript |
| **pg-boss → BullMQ migration later** | churn | thin `Queue` port; job payloads versioned |

**Affiliate compliance (spec §37):** disclosure text is a campaign field; generator injects it;
guardrails block fabricated prices/specs/reviews/availability/earnings; approval required always.

---

## 7. Open questions for the founder (non-blocking — defaults chosen)

1. **Default brand name/voice** — placeholder "SoloNomous Labs" per spec; confirm later.
2. **Timezone default** — stored per campaign (default UTC); your local tz will be set during Phase 3 onboarding.
3. **First platform choice for Phase 7** — I recommend **Instagram** (you listed it first and its API is the most capable organic publishing surface); say the word if you'd rather start with LinkedIn or TikTok.
4. **Email magic-link login** — needs SMTP creds; default plan is credentials-only until provided.

---

*Review these five docs, then issue **"START PHASE 1"** to begin implementation (Phase 1 only).*
