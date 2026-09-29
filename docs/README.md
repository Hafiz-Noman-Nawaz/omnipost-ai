# OmniPost Agent — Phase 0 Planning Docs

Internal AI-powered social media automation platform.
**Status: Phase 12 (Autonomous AI Social Media Agent) complete — see `docs/phases/phase-12.md`.**
**All 12 Phases of the OmniPost Agent Master Product Specification are now completely built, verified, and operational!**
Founding directive: personal/internal product first; multi-tenant-ready architecture;
no paid-tier gating (all limits default to unlimited; plan fields are inert seams for a future SaaS).

## Read in order

1. **[01 — Architecture & Stack](01-architecture-and-stack.md)**
   System diagram, technology choices with rationale, folder structure, ports & adapters, key decisions (ADRs).
2. **[02 — Database Schema](02-database-schema.md)**
   ERD, full Prisma schema (all 20+ entities from the spec), status enums, design notes.
3. **[03 — API Specification](03-api-specification.md)**
   REST endpoint catalog, envelopes, RBAC per endpoint, error codes, idempotency/confirmation semantics.
4. **[04 — Agent & Providers](04-agent-and-providers.md)**
   Agent runtime, permission-gated tool catalog (READ/WRITE/HIGH_RISK), prompt registry, LLM abstraction,
   `SocialProvider` interface + capability matrix, prompt-injection defense, comment automation flow.
5. **[05 — Security, Testing, Roadmap & Risks](05-security-testing-roadmap.md)**
   Security model, env var contract, testing strategy (incl. agent + injection tests),
   phase-by-phase plan, researched platform limitations, open questions.

## Key platform facts verified (Sept 2026)

- **Instagram:** professional account + Meta App Review; 100 API posts / 24h rolling cap.
- **TikTok:** unaudited API clients post as **private**; public posting needs an app audit.
- **X:** pay-per-use (~$0.015/post; links cost more; reads billed).
- **LinkedIn:** `w_member_social` self-serve; org posting + comment APIs have restrictions.
- Full table with constraints: [Doc 4 §5](04-agent-and-providers.md).

## Phase Reports

Phase completion reports live in `docs/phases/`:
- [Phase 1: Architecture & Foundation](phases/phase-1.md)
- [Phase 2: Content Vault & Asset Storage](phases/phase-2.md)
- [Phase 3: Campaign System](phases/phase-3.md)
- [Phase 4: AI Generation & Safety Guardrails](phases/phase-4.md)
- [Phase 5: Approval Workflow & Post Management](phases/phase-5.md)
- [Phase 6: Calendar & Scheduling Worker](phases/phase-6.md)
- [Phase 7: Multi-Channel Account Connection](phases/phase-7.md)
- [Phase 8: Social Provider Adapters & Live Dispatch](phases/phase-8.md)
- [Phase 9: Comments Ingestion & Moderation](phases/phase-9.md)
- [Phase 10: Response Library & Automation Rules](phases/phase-10.md)
- [Phase 11: Honest Metrics & Analytics Dashboard](phases/phase-11.md)
- [Phase 12: Autonomous AI Social Media Agent](phases/phase-12.md)



