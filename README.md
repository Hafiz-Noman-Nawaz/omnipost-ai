# OmniPost Agent

Personal, AI-powered social media automation platform. Phase 0 planning lives in
[`docs/`](docs/README.md); implementation follows the phase plan in
[`docs/05-security-testing-roadmap.md` §5](docs/05-security-testing-roadmap.md).

## Status

**Phase 2 — Content Vault: complete & verified** (bulk upload with drag-&-drop, storage adapter,
search/filtering, campaign association — see [`docs/phases/phase-2.md`](docs/phases/phase-2.md)).
Phase 1 (auth, tenancy, dashboard shell, audit log): [`docs/phases/phase-1.md`](docs/phases/phase-1.md).
Next: Phase 3, Campaign System.

## Quickstart

```bash
npm install            # install all workspaces
docker compose up -d   # start Postgres on host port 5433
cp .env.example .env   # then fill AUTH_SECRET / TOKEN_ENCRYPTION_KEY (see below)
npm run db:migrate     # create schema in the database
npm run dev            # http://localhost:3000
```

Generate dev secrets with:

```bash
node -e "const c=require('crypto');console.log('AUTH_SECRET='+c.randomBytes(32).toString('base64'));console.log('TOKEN_ENCRYPTION_KEY='+c.randomBytes(32).toString('base64'))"
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dashboard on :3000 (Turbopack) |
| `npm run build` | production build |
| `npm run typecheck` | tsc across all workspaces |
| `npm test` | Vitest suites across all workspaces |
| `npm run db:migrate` | apply Prisma migrations |
| `npm run db:generate` | regenerate Prisma client after schema edits |

## Notes

- Postgres runs on host port **5433** because this machine has a native Postgres on 5432.
- Secrets never enter git: `.env` is ignored; `.env.example` is the contract.
