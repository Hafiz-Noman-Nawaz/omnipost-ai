# Phase 3 — Campaign System: Completion Report

**Status: COMPLETE — implemented, tested, built, and manually verified.**
Date: 2026-09-28

---

## What was delivered

| Area | Details |
|---|---|
| **Schema** | `Campaign` extended to the full docs/02 §2 model: `brandId` (FK), `objective`, `targetAudience`, `tone`, `brandVoice` (per-campaign override), `cta`, `landingUrl`, `platforms` (PlatformKey[]), `timezone` (IANA, default UTC), `startDate`/`endDate`, `approvalRequired`, `postingFrequency` (JSONB `{perDay, windows[]}`), affiliate fields (`affiliateNetwork`, `affiliateUrl`, `disclosureText`), `pausedAt`. Migration `20260928200000_campaign_system` applied (additive; existing content associations untouched), client regenerated |
| **`packages/shared`** | New `platforms.ts`: `PLATFORM_KEYS` (INSTAGRAM, FACEBOOK, LINKEDIN, TIKTOK, X, YOUTUBE per docs/04 §5), labels, type guard — pure constants so client components can import them without pulling in Prisma |
| **Campaigns repo** | Org-scoped CRUD; lifecycle state machine `DRAFT → ACTIVE ⇄ PAUSED → COMPLETED → ARCHIVED` (ARCHIVED is terminal); dedicated `pauseCampaign`/`resumeCampaign` (resume only from PAUSED — a DRAFT was never running); `pausedAt` stamp/clear; validation: IANA timezone check, start<end, platform keys, postingFrequency shape (perDay 1–50, HH:MM windows); brand cross-org check (NOT_FOUND, no existence leak); archive-vs-delete semantics (campaigns with content archive, empty ones hard-delete); filters status/platform/brand + pagination/sorting; detail includes brand + content count |
| **Brands repo** | Org-scoped CRUD with single-default enforcement (`isDefault` demotes all others only when a brand *is* default — no accidental demotion on unrelated writes); guidelines as JSON; deletion refused while campaigns still reference the brand (`in-use`) |
| **REST API** | `GET|POST /api/rest/campaigns`, `GET|PATCH|DELETE /api/rest/campaigns/:id`, `POST .../campaigns/:id/pause`, `POST .../campaigns/:id/resume` (pause/resume/DELETE are ADMIN per docs/03; create/edit EDITOR; read VIEWER), `GET|POST /api/rest/brands`, `GET|PATCH|DELETE /api/rest/brands/:id`. Zod validation on every write; audit entries: `campaign.created/updated/paused/resumed/deleted/archived`, `brand.created/updated/deleted` |
| **UI (Campaigns page)** | Real page replaces the placeholder: status filter; create/edit form with every spec §8 field — brand-profile select, objective, audience, tone, brand-voice override, CTA + landing URL, platform multi-select (toggle chips), timezone, date pickers, posts-per-day + posting windows, affiliate fields + disclosure, approval toggle; lifecycle buttons per state (Activate / Pause / Resume / Complete / Delete-Archive); card list with status badges, platform badges, frequency display, brand tag, content count |
| **Brand profiles UI** | Inline panel on the campaigns page: edit voice/avoid/audience/name (dirty-state save), make-default (with demotion), delete (only when unused), create new (optionally as default) |
| **Content integration** | ContentLibrary now has a campaign select in the TEXT/LINK creator form and a campaign filter in the filter bar; the campaign delete/archive state shows on cards |

## Verification evidence

- **Tests:** 60 passing total — 12 new database integration tests (campaigns: full-payload create, org isolation incl. cross-org PATCH, platform/timezone/date/frequency/brand validation, lifecycle transitions, pause/resume incl. double-pause + cross-org 404, list filters/pagination, archive-vs-delete; brands: org scoping, single-default enforcement, update/validation, in-use delete guard). Previous 48 all still green (13 media, 11 auth, 9 database, 15 shared → now 21 database).
- **Typecheck:** all 6 workspaces pass. **Build:** production `next build --turbopack` clean after cache clear; all new routes present (`api/rest/brands`, `api/rest/campaigns`, `api/rest/campaigns/[id]`, `api/rest/campaigns/[id]/[action]`, `/campaigns` page).
- **Build note:** the `/_global-error` prerender flake (Phase 2 note) recurred 3× in a row; a `rm -rf apps/web/.next` + rebuild passed cleanly — worth remembering the cache clear beats blind retries.
- **API (curl, production server, org A = founder@omnipost.test):** full-field create → 201 with all values echoed (postingFrequency JSON round-trips); pause while DRAFT → 409 with human message ("Allowed: ACTIVE, ARCHIVED"); activate → pause (`pausedAt` stamped) → double-pause 409 → resume (`pausedAt` null); bad platform/timezone/dates/window → 400 with readable messages; unauthenticated list → 401; org B reads/patches org A's campaign → 404 (no existence leak); brands list → bootstrapped default; create brand → not default; make default → exactly 1 default remains; TEXT content created with `campaignId` → vault filter `?campaignId=` returns it; DELETE campaign with content → `archived` (status ARCHIVED).
- **Browser (real UI, org B = founder-ui@omnipost.test):** created "November launch push" via the form (LinkedIn + X chips, windows 09:00/18:00, objective) → card appeared DRAFT with approval badge; Activate → ACTIVE; Pause → PAUSED; Resume → ACTIVE (each confirmed by server state + audit trail: `campaign.created → updated → pause → resume` timestamps). Tenancy: org B sees only its own campaign and brand; org A's data invisible.
- **Audit:** campaign and brand actions land in the org audit log with actor, resource and metadata.

## Deviations / notes

- `resumeCampaign` intentionally requires PAUSED status (docs/03's resume endpoint is the inverse of pause); DRAFT → ACTIVE goes through PATCH `status` or the UI Activate button instead.
- Brand deletion is blocked while campaigns reference the brand (HTTP 409 with guidance) — reassignment UI arrives with post/scheduling phases; deleting a campaign never touches its content.
- `deleteCampaign` on a COMPLETED campaign would violate the transition map when archiving-with-content is needed; currently allowed only from DRAFT/ACTIVE/PAUSED (COMPLETED campaigns keep their history until the analytics phase decides the policy).
- Phase 2's `createCampaignForTests` helper remains for content tests; real creation now goes through the campaigns repo.
- Extensionless-import sweep re-run after all edits (Turbopack `.js`-extension gotcha).

## Phase 3 exit criteria (spec §51)

Implemented ✅ · Backend-connected ✅ · Validation ✅ (platforms, timezone, dates, frequency, brand scope, lifecycle) ·
Error handling ✅ (human-readable conflicts/rejections, no existence leaks) · Tests ✅ · App runs ✅ ·
Manually verified (API + browser + audit trail) ✅ · Documented ✅ ·
Security reviewed (org isolation cross-org read/patch/pause/delete, RBAC ADMIN for pause/resume/delete, unauthenticated 401, audit logging) ✅

**Next: Phase 4 — AI content generation (caption variants from campaign + brand context, provider abstraction).**
