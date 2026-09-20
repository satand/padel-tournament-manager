# AGENTS.md

Padel tournament manager: Next.js 16 (App Router) + React 19 PWA, PostgreSQL via Prisma 6. All docs in this repo (README, TECHNICAL_DESIGN) are in Italian; code comments are mixed.

## Commands

- Dev/build: `npm run dev`, `npm run build`
- Tests: `npm test` (Vitest, `vitest run`). Single file: `npx vitest run src/tests/ranking.test.ts`; single case: add `-t "test name"`.
- Typecheck: `npx tsc --noEmit` (there is **no** `typecheck` script in package.json).
- Prisma: `npm run prisma:generate` (run after fresh install or schema changes, before dev/build), `npm run prisma:migrate` (migrate dev, dev-only), `npm run prisma:seed` (demo data via tsx).
- `npm run lint` is **broken**: `next lint` no longer exists in Next 16 and no ESLint config is installed. Do not run it; verify with `npx tsc --noEmit` + tests.
- No CI workflows, no pre-commit hooks.

## Architecture

- `src/lib/domain/` — pure TypeScript tournament engine (ranking, mvp, scheduler, validators, exports, types). No Prisma/Next imports; functions take `(participants, matches, rules)` and return results. Keep it pure; all tests live in `src/tests/*.test.ts` and import it via the `@/` alias (mapped in both `vitest.config.ts` and `tsconfig.json`).
- `src/lib/server/` — Prisma client singleton (`db.ts`), RBAC permission map (`rbac.ts`), audit log (`audit.ts`).
- `src/app/api/` — route handlers. `api/demo` + `src/lib/demo/demo-data.ts` serve static demo data with **no database**. All write endpoints (`tournaments` CRUD, participants, results, `generate`) require PostgreSQL + applied migrations.
- `src/components/` — client UI (wizard, tables, PWA service worker registration).
- `prisma/schema.prisma` — relational model; migrations in `prisma/migrations/`.
- PWA: `public/manifest.webmanifest` + `public/sw.js`, registered by `src/components/ServiceWorkerRegister.tsx`.

## Environment & gotchas

- `.env` and `opencode.jsonc` are gitignored (the latter holds local model-provider config with API keys) — never commit them. Use `.env.example` as reference.
- `DATABASE_URL` values must be **unquoted** in `.env` (works with dotenv and `docker run --env-file`, which don't strip quotes).
- Demo mode works with no database; any feature that writes (create tournament, add participants, generate calendar, save results, delete) needs a reachable Postgres with migrations applied.
- Docker: app image builds from `docker/Dockerfile` (runs `prisma generate` + `next build`); full stack in `docker/docker-compose.yml` (db + app, db healthcheck gates app start).

## Verification loop

After any code change: `npx tsc --noEmit` and `npm test` (DB not required). Domain-engine changes should add/extend tests in `src/tests/` mirroring existing style (vitest, `@/lib/domain/...` imports).