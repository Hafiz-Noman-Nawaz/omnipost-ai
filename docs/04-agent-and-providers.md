# OmniPost Agent — Agent Architecture, Tool Catalog & Provider Interface (Phase 0, Doc 4/5)

> Status: **Proposal — awaiting founder review.**
> Core principle (spec §2, §14, §15, §42): the LLM never touches the DB, network, or tokens directly.
> It may only select tools from a whitelisted, permission-classified catalog. Permissions are
> enforced by backend code; prompt text is never the security boundary.

---

## 1. Agent runtime

```text
User message / worker trigger
        ↓
AgentRunner (packages/ai)
  ├─ loads: system prompt + memory (short-term, campaign, brand, user prefs)
  ├─ wraps all EXTERNAL TEXT as data (delimited, escaped — see §6)
  ├─ LLMProvider.toolCall(catalog subset allowed for this actor/role)
  │        ↓ model emits tool call
  ├─ PermissionGate.validate(actor, tool, args)      ← backend-enforced (spec §42)
  │     ├─ RBAC check (role ≥ tool.minRole)
  │     ├─ org-scope check on every id arg (repo-level)
  │     ├─ risk-class check (HIGH_RISK → require explicit confirmation token)
  │     └─ rate/quota check (unlimited for founder; seam for SaaS)
  ├─ Tool.execute()  → validated Zod args → service layer → repos/providers
  ├─ result → LLM → next step or final answer
  └─ every step logged to AgentExecution / AgentToolCall + AuditLog
```

- **Loop limits:** max 12 tool calls per execution; max 30s per tool; hard stop and escalate on repeated permission denials (injection-defense tripwire).
- **Confirmation protocol (spec §26):** when the runner blocks a HIGH_RISK tool, it returns a
  `pending_confirmation` card to the chat UI (`{ executionId, toolCallId, preview }`). The user
  clicks Approve/Cancel → `POST /api/rest/agent/confirm` → runner executes or discards. The model
  cannot self-approve; the confirm endpoint requires the session user with ADMIN role.
- **Memory (spec §35):** short-term = current execution messages; campaign memory = `CampaignMemory`
  rows; brand memory = `Brand`; user prefs = `User.preferences`. Memory is *context only* — it can
  never expand tool permissions or override PermissionGate decisions.

---

## 2. Tool catalog (initial)

Risk classes: **READ** (safe), **WRITE** (mutates our data), **HIGH_RISK** (touches the outside world or is destructive). `minRole` uses the Role enum from Doc 2.

| Tool | Class | minRole | Description |
|---|---|---|---|
| `get_campaign` | READ | VIEWER | campaign + counts |
| `get_content` | READ | VIEWER | vault item(s) by filter |
| `get_scheduled_posts` | READ | VIEWER | calendar slice / status filter |
| `get_post_status` | READ | VIEWER | incl. platformPostId, error, attempts |
| `get_comments` | READ | VIEWER | by post/campaign/status/intent |
| `get_analytics` | READ | VIEWER | rollups from PostMetric only |
| `get_accounts` | READ | VIEWER | connected accounts + capabilities (no tokens) |
| `search_web_allowed` | READ | EDITOR | (future) fetch public product info for campaign research |
| `create_content_draft` | WRITE | EDITOR | vault item from text/link or from uploaded media refs |
| `create_campaign` | WRITE | EDITOR | campaign object (spec §8 fields) |
| `generate_caption` | WRITE | EDITOR | single caption package (caption+hashtags+hook+cta) |
| `generate_platform_variation` | WRITE | EDITOR | per-platform variants for a content item |
| `create_post_draft` | WRITE | EDITOR | Post in DRAFT/AI_GENERATED (never skips approval states) |
| `update_post_draft` | WRITE | EDITOR | edits only while pre-approval |
| `schedule_post` | WRITE | ADMIN | creates ScheduledPost; validates capability + approval state |
| `cancel_scheduled_post` | WRITE | ADMIN | |
| `generate_reply` | WRITE | EDITOR | reply suggestion from template library + comment intent |
| `request_human_approval` | WRITE | EDITOR | flags post/thread for approval + notification |
| `repurpose_content` | WRITE | EDITOR | spec §38/§39 multi-angle drafts |
| `pause_campaign` / `resume_campaign` | WRITE | ADMIN | |
| `create_notification` | WRITE | EDITOR | agent → notification center |
| `publish_post` | HIGH_RISK | ADMIN | confirmation required; idempotency-keyed |
| `reply_to_comment` | HIGH_RISK | ADMIN | confirmation unless safe-listed rule matched |
| `send_dm` | HIGH_RISK | ADMIN | only where API permits; confirmation always |
| `delete_post` | HIGH_RISK | ADMIN | confirmation always |
| `hide_comment` | HIGH_RISK | ADMIN | platform-permitting |

Rules:
- HIGH_RISK always routes through `request_human_approval` unless the founder has enabled
  automation for that exact operation (Automation settings, org-scoped toggle, default **off**).
- The catalog exposed to the model is filtered per actor role before the request is sent —
  the model is never told about tools it cannot call.
- Every call (allowed *and* denied) is persisted to `AgentToolCall` with `denialReason`.

---

## 3. Prompt management (spec §34)

```text
packages/prompts/
├── system/
│   └── agent_system.md          # identity, hard rules, escalation policy
├── content/
│   ├── caption_generator_v1.md  # inputs: content, campaign, brand, audience, platform
│   └── platform_variations_v1.md
├── comments/
│   ├── comment_classifier_v1.md # → intent + confidence + safety flags
│   └── reply_suggester_v1.md
├── analytics/
│   └── analytics_summarizer_v1.md  # numbers-in → grounded narrative out
├── planning/
│   ├── repurposing_planner_v1.md
│   └── daily_report_v1.md
└── safety/
    └── content_guardrails_v1.md    # spec §36 pre-publication screen
```

- Registry exposes `getPrompt(name, version?)` with typed input/output Zod schemas; A/B testing
  later = add `v2` file + registry flag. Prompts are markdown with a structured output contract.
- Model choice and prompt version are recorded on every generation (`ContentVariant.model`,
  `.promptVersion`) for reproducibility.

---

## 4. LLM abstraction (spec §33)

```ts
// packages/ai/src/port.ts
export interface LLMProvider {
  readonly id: string;                       // "anthropic" | "openai" | ...
  complete(req: CompleteRequest): Promise<CompleteResponse>;
  stream(req: CompleteRequest): AsyncIterable<StreamEvent>;
  toolLoop(req: ToolLoopRequest, handlers: ToolHandlers): Promise<AgentResult>;
}
```

Adapters: `AnthropicProvider` (default), `OpenAIProvider`; Gemini/DeepSeek later. Selection via
env (`AI_PROVIDER`, `AI_MODEL`) with per-task overrides possible (e.g. cheap model for comment
classification, strongest model for campaign planning). The rest of the system depends only on
the port.

---

## 5. SocialProvider interface (spec §4)

```ts
// packages/providers/src/port.ts
export type PlatformKey = 'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN' | 'TIKTOK' | 'X' | 'YOUTUBE';

export interface SocialProvider {
  readonly platform: PlatformKey;

  readonly capabilities: CapabilityMatrix;   // static truth per platform — drives UI + tool gating

  connect(input: ConnectInput): Promise<ConnectResult>;            // OAuth URL + state
  handleCallback(input: CallbackInput): Promise<ConnectedAccount>;  // code→token, encrypted upstream
  disconnect(account: AccountRef): Promise<void>;                  // revoke where supported
  validateCredentials(account: AccountRef): Promise<TokenStatus>;

  createPost(req: CreatePostInput): Promise<CreatePostResult>;     // returns platformPostId
  getPostStatus(ref: PostRef): Promise<PostStatusResult>;

  getComments?(ref: PostRef, page?: Pagination): Promise<CommentPage>;   // optional!
  replyToComment?(ref: CommentRef, body: string): Promise<CommentRef>;   // optional!
  getAnalytics?(ref: PostRef, range: DateRange): Promise<MetricSnapshot>; // optional!

  mapError(err: unknown): PlatformError;      // → uniform { code, human, retryable }
}
```

`CapabilityMatrix`:

```ts
interface CapabilityMatrix {
  supportsPublishing: boolean;
  supportsSchedulingNative: boolean;   // false = we hold & publish at time T
  supportsComments: boolean;
  supportsReplyToComment: boolean;
  supportsDm: boolean;
  supportsDelete: boolean;
  supportsAnalytics: boolean;
  media: { images: boolean; video: boolean; carousel: boolean;
           maxDurationSec?: number; aspectRatios: string[]; maxCaptionLength: number };
  notes: string;   // human-readable limits shown in UI (spec §4)
}
```

UI and tools read the matrix; **nothing "assumes" an operation exists** — optional methods +
matrix flags gate every path, and the calendar/composer disables what a platform can't do, with
the `notes` shown inline.

### Platform reality check (verified Sept 2026 — re-verify per platform in its phase)

| Platform | Publish | Comments | Analytics | Hard constraints |
|---|---|---|---|---|
| **Instagram** | ✅ Graph API | ✅ (business/creator) | ✅ insights | Professional account + Facebook Page linked + Meta App Review; **100 API posts / 24h rolling**; Reels/video via container flow; hashtags ≤30 |
| **Facebook** | ✅ Page API | ✅ | ✅ | Page (not profile); App Review for `pages_manage_posts` |
| **LinkedIn** | ✅ member/org posts | ⚠️ limited | ✅ (org) | `w_member_social` self-serve product; org posting needs `w_organization_social` + admin; comment APIs restricted for member posts |
| **TikTok** | ✅ Content Posting API | ⚠️ | ⚠️ | **Unaudited clients: posts land as PRIVATE**, ≤5 users/24h; public posting requires app audit; upload URL flow, processing async |
| **X** | ✅ | ✅ (paid reads) | ⚠️ | **Pay-per-use** (~$0.015/post; links priced higher; reads billed) — costs must surface in UI |
| **YouTube** | ✅ videos | ✅ | ✅ | OAuth + quota units; shorts vs long-form nuance |

This table is informational; each provider phase re-verifies against official docs before code lands (spec §46 Phase 8 step 1–2, and §"never invent API functionality").

---

## 6. Prompt-injection defense (spec §42)

1. **All external text is data.** Comments, captions, fetched page text, and file contents are passed
   inside explicitly delimited, escaped blocks (`<external_content>…</external_content>` with
   length caps), never as chat-role content, never concatenated into instructions.
2. **Permissions live in code.** The PermissionGate re-checks role, org-scope, and risk class on
   every tool call regardless of what the model "believes" it was told.
3. **No silent state change.** The model cannot alter automation settings, roles, tokens, or the
   tool catalog; those have no tools at all (only REST endpoints for the human).
4. **Tripwires.** Patterns like "ignore previous instructions" in external content flag the
   execution, truncate the content, and are recorded in `AgentExecution.promptInjectionFlags`;
   repeated hits pause autonomous actions for that campaign and notify the human.
5. **Output firewall.** Generated captions pass the safety guardrail prompt + regex rules
   (disclosure presence for affiliate campaigns, banned-claims list from Brand.avoid) before they
   can reach approval; flag → `AWAITING_APPROVAL` with visible safety notes.

---

## 7. Comment automation flow (spec §16–§18)

```text
new comment (worker sync)
  → classification (intent + confidence + safety)
  → route:
      confidence < 0.6                       → UNKNOWN → suggest only
      intent ∈ {ABUSE, COMPLAINT, NEGATIVE}  → ESCALATE (+notification)
      auto-reply master switch OFF           → suggest only
      rule matches (priority order) → AUTO_REPLY template (variables rendered, disclosure kept)
                                   or SUGGEST_REPLY / ESCALATE / HIDE
  → every AUTO_REPLY on HIGH_RISK path logs + can be disabled globally
```

Human-attention categories (never auto-handled): threats, harassment, medical/legal claims,
refund requests, account/security issues, sensitive complaints, political content.

---

*Next doc: `05-security-testing-roadmap.md` — security model, env vars, testing strategy, phases, risks.*
