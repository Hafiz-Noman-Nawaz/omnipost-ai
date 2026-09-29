# OmniPost Agent — API Specification (Phase 0, Doc 3/5)

> Status: **Phase 1 subset implemented & verified** (see `docs/phases/phase-1.md`); the full
> catalog below remains the contract for later phases.
> REST via Next.js route handlers under `/api/rest/*`, session-cookie auth, Zod-validated bodies,
> tenant scoped to the caller's organization. Agent chat uses `/api/rest/agent/...` (streaming).
>
> **Implemented so far:** `POST /api/auth/register|login|logout`, `GET /api/auth/session`,
> `GET|PATCH /api/rest/settings`, `GET /api/rest/audit`, `GET /api/rest/dashboard/summary`,
> `GET /api/rest/health`; Content Vault (Phase 2): `POST /api/rest/content/upload` (bulk
> multipart), `GET|POST /api/rest/content`, `GET|PATCH|DELETE /api/rest/content/:id`,
> `GET /api/rest/content/:id/file` (authorized streaming); Campaign System (Phase 3):
> `GET|POST /api/rest/campaigns`, `GET|PATCH|DELETE /api/rest/campaigns/:id`,
> `POST /api/rest/campaigns/:id/pause`, `POST /api/rest/campaigns/:id/resume`,
> `GET|POST /api/rest/brands`, `GET|PATCH|DELETE /api/rest/brands/:id`; AI generation (Phase 4):
> `POST /api/rest/content/:id/generate` (per-platform caption variants),
> `GET /api/rest/content/:id/variants`, `PATCH /api/rest/variants/:id` (approve/reject).

---

## 1. Conventions

**Auth:** every endpoint except `/api/rest/health` requires a valid session. The session's active
organization resolves the tenant; all queries are org-scoped in repo code.

**RBAC:** `VIEWER` read-only; `EDITOR` may create/edit content, campaigns, drafts; `ADMIN` may
approve/publish/schedule/manage accounts; `OWNER` everything incl. settings. Enforced server-side
in every handler (`requireRole(req, 'ADMIN')`), never by UI alone.

**Success envelope:**

```json
{ "data": { ... }, "meta": { "page": 1, "pageSize": 25, "total": 132 } }
```

**Error envelope (uniform, human-readable per spec §27):**

```json
{
  "error": {
    "code": "PLATFORM_PERMISSION_DENIED",
    "message": "Instagram rejected this post because the connected account does not have the required publishing permission.",
    "details": { "platform": "INSTAGRAM", "httpStatus": 403 },
    "correlationId": "req_01J..."
  }
}
```

**Pagination:** `?page=&pageSize=&sort=`; **filtering:** query params documented per endpoint;
**rate limiting:** per-user token bucket at the edge for mutations (security doc).

---

## 2. Endpoint catalog

### Health & system
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/rest/health` | public | liveness + db ping |

### Auth
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | public | email+password (argon2id); creates default org, Owner membership |
| POST | `/api/auth/login` | public | credentials; sets secure session cookie |
| POST | `/api/auth/logout` | user | clears session |
| GET | `/api/auth/session` | user | current user + org + role |

### Dashboard
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/rest/dashboard/summary` | VIEWER | widget counts: today's posts, pending approvals, scheduled, published, failed, comments, attention-required |

### Content Vault
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/rest/content` | VIEWER | filters: `q, type, status, campaignId, tag`; paginated |
| POST | `/api/rest/content/upload` | EDITOR | multipart; supports multiple files; returns Content rows |
| POST | `/api/rest/content/text` | EDITOR | create TEXT/LINK items |
| GET | `/api/rest/content/:id` | VIEWER | |
| PATCH | `/api/rest/content/:id` | EDITOR | title/description/tags/campaign/status |
| DELETE | `/api/rest/content/:id` | EDITOR | soft archive if referenced by posts |
| POST | `/api/rest/content/:id/repurpose` | EDITOR | body: `{ targetPlatforms: string[], angles?: string[] }` → enqueues generation job, returns Post drafts (spec §38/§39) |

### Campaigns
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/rest/campaigns` | VIEWER | filters: `status, platform` |
| POST | `/api/rest/campaigns` | EDITOR | full campaign payload (spec §8) |
| GET | `/api/rest/campaigns/:id` | VIEWER | includes counts + memory |
| PATCH | `/api/rest/campaigns/:id` | EDITOR | |
| POST | `/api/rest/campaigns/:id/pause` | ADMIN | sets status PAUSED; worker skips its queue jobs |
| POST | `/api/rest/campaigns/:id/resume` | ADMIN | |
| DELETE | `/api/rest/campaigns/:id` | ADMIN | archive semantics |

### Posts & variants
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/rest/posts` | VIEWER | filters: `status, campaignId, platform, contentId` |
| POST | `/api/rest/posts` | EDITOR | create draft (manual or from variant) |
| GET | `/api/rest/posts/:id` | VIEWER | |
| PATCH | `/api/rest/posts/:id` | EDITOR | edit caption/hashtags/link/media while pre-approval |
| POST | `/api/rest/posts/:id/generate` | EDITOR | (re)generate platform variation via AI; body: `{ notes?: string }` |
| DELETE | `/api/rest/posts/:id` | EDITOR | allowed pre-approval only |

### Approvals (spec §11)
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/rest/approvals` | VIEWER | queue: posts in AWAITING_APPROVAL + AI_GENERATED |
| POST | `/api/rest/posts/:id/approve` | ADMIN | moves to APPROVED (or SCHEDULED if scheduledAt provided) |
| POST | `/api/rest/posts/:id/reject` | ADMIN | body: `{ reason }` |
| POST | `/api/rest/posts/:id/duplicate` | EDITOR | copy as DRAFT |
| POST | `/api/rest/approvals/bulk` | ADMIN | `{ action: "approve"|"reject", postIds: string[], scheduledAt?: string }` |

### Scheduling & publishing
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/api/rest/posts/:id/schedule` | ADMIN | body: `{ scheduledAt, timezone, socialAccountId? }` → validates account capability + token state; creates ScheduledPost (QUEUED) |
| POST | `/api/rest/posts/:id/publish-now` | ADMIN | HIGH_RISK path: requires confirmation token from UI (spec §26); enqueues immediate job |
| GET | `/api/rest/scheduled` | VIEWER | calendar feed data; filters: `from, to, platform, status, campaignId` |
| PATCH | `/api/rest/scheduled/:id` | ADMIN | reschedule (only while QUEUED) |
| POST | `/api/rest/scheduled/:id/cancel` | ADMIN | |
| POST | `/api/rest/scheduled/:id/retry` | ADMIN | manual retry of FAILED |

### Connected accounts (spec §6)
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/rest/accounts` | VIEWER | list w/o any token material; includes capability matrix + status |
| GET | `/api/rest/accounts/:id` | VIEWER | detail: scopes, connectedAt, tokenExpiresAt, lastAction |
| POST | `/api/rest/accounts/:id/refresh` | ADMIN | force token refresh / revalidation |
| DELETE | `/api/rest/accounts/:id` | ADMIN | disconnect; revokes where API allows |
| GET | `/api/oauth/:platform/start` | ADMIN | begins platform OAuth (state + PKCE where supported) |
| GET | `/api/oauth/:platform/callback` | ADMIN | exchanges code server-side; encrypts tokens; never exposes them |

### Comments & conversations (spec §17)
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/rest/comments` | VIEWER | filters: `status, intent, postId, platform, requiresHuman` |
| POST | `/api/rest/comments/:id/classify` | EDITOR | re-run classification |
| GET | `/api/rest/comments/:id/suggestions` | VIEWER | AI reply suggestions |
| POST | `/api/rest/comments/:id/reply` | ADMIN | body: `{ body, templateId? }` — HIGH_RISK, platform-permitting |
| POST | `/api/rest/comments/:id/hide` | ADMIN | platform-permitting |
| POST | `/api/rest/comments/:id/escalate` | EDITOR | mark thread requiresHuman + notification |

### Response library & automation (spec §18/§19)
| Method | Path | Role | Notes |
|---|---|---|---|
| CRUD | `/api/rest/responses` | EDITOR | ResponseTemplate; variable syntax `{{link}}` validated |
| GET | `/api/rest/automation/settings` | VIEWER | global toggles (auto-reply master switch, escalation categories) |
| PATCH | `/api/rest/automation/settings` | ADMIN | |
| CRUD | `/api/rest/rules` | ADMIN | AutomationRule ordering by priority |

### Analytics (spec §20)
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/rest/analytics/overview` | VIEWER | `{ range, platforms: { [p]: { available: [...], unavailable: [...] } } }` |
| GET | `/api/rest/analytics/posts` | VIEWER | per-post metric snapshots |
| GET | `/api/rest/analytics/campaigns/:id` | VIEWER | rollups from real PostMetric rows only |
| POST | `/api/rest/analytics/sync` | ADMIN | enqueue metrics fetch job for connected platforms |
| GET | `/api/rest/analytics/ask?q=` | VIEWER | AI summary over stored metrics; refuses unsupported claims |

### Notifications
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/rest/notifications` | VIEWER | `?unread=true` |
| POST | `/api/rest/notifications/read` | user | `{ ids: [] }` |

### Agent (spec §25)
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/api/rest/agent/chat` | EDITOR | SSE stream; body: `{ message, executionId? }`; returns tool-call events + final answer |
| GET | `/api/rest/agent/executions` | VIEWER | history incl. tool calls + denials |
| POST | `/api/rest/agent/confirm` | ADMIN | approve/cancel a pending HIGH_RISK action surfaced in chat |

### Brand & memory (spec §10/§35)
| Method | Path | Role | Notes |
|---|---|---|---|
| CRUD | `/api/rest/brands` | EDITOR | voice/avoid/audience/guidelines |
| GET/PATCH | `/api/rest/settings/brand-defaults` | ADMIN | default brand for new campaigns |

### Audit (spec §29)
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/rest/audit` | ADMIN | filters: `actor, action, resourceType, from, to` |

---

## 3. Standard error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod failure; `details.fieldErrors` |
| `UNAUTHENTICATED` | 401 | no/invalid session |
| `FORBIDDEN` | 403 | RBAC or org-scope rejection |
| `NOT_FOUND` | 404 | resource not in this org |
| `CONFLICT` | 409 | state transition not allowed (e.g. approve a published post) |
| `RATE_LIMITED` | 429 | too many requests |
| `CAPABILITY_UNSUPPORTED` | 422 | platform cannot do this (e.g. comments on X on some tiers) |
| `ACCOUNT_TOKEN_EXPIRED` | 409 | reconnect required |
| `PLATFORM_PERMISSION_DENIED` | 402/422 | platform rejected scope/permission |
| `PLATFORM_RATE_LIMITED` | 429 | upstream 429; backoff scheduled |
| `PLATFORM_MEDIA_INVALID` | 422 | e.g. aspect-ratio/duration violation |
| `INTERNAL` | 500 | logged with correlationId |

Every platform-derived failure maps to a code + human sentence; raw provider errors are stored in
`PublishAttempt` / `lastError` JSON, never shown raw to the UI (spec §27).

---

## 4. Idempotency & confirmation semantics

- Mutating POSTs accept `Idempotency-Key` header; server caches result for 24h (dashboard double-clicks).
- `publish-now` and bulk approvals require `confirm: true` in the body (UI shows the §26 confirmation dialog). Missing confirmation → `409 CONFIRMATION_REQUIRED`.
- Scheduling validates: post APPROVED, campaign not PAUSED/ended, account CONNECTED with publish capability, timezone valid, no duplicate (same post+platform already QUEUED within a minute window).

---

*Next doc: `04-agent-and-providers.md` — agent loop, tool catalog, provider interface.*
