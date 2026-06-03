# Runbook — running and testing locally

## Prerequisites
- Node >= 20, pnpm >= 9.
- Postgres (local or Docker) for backend integration beyond unit level.
- (For e2e) Playwright browsers: `pnpm --filter @app/e2e exec playwright install`.

## First-time setup
```bash
pnpm install
cp .env.example .env        # fill in local values; NEVER commit .env
```

## Everyday commands
```bash
pnpm dev                    # run frontend + backend together
pnpm test:backend           # fast BE feedback (Vitest)
pnpm test:frontend          # fast FE feedback (Vitest + Testing Library)
pnpm test:e2e               # Playwright (needs the stack running)
pnpm verify                 # typecheck + lint + ALL tests — the real gate
```

## The agent loop uses these
The `run-suite.sh` hook runs the current layer's command from `.claude/tdd.config`:
- backend  → `BE_TEST_CMD`
- frontend → `FE_TEST_CMD`
- e2e      → `E2E_TEST_CMD`
Keep those in sync with the scripts in each workspace's `package.json`.

## Database / migrations
- Migrations are forward-only and live with their feature. Apply with the
  project's migration tool (add it in ADR + this runbook when introduced).
- Never edit a shipped migration; add a new one.

## Secrets
All secrets come from `.env` (gitignored). `.env.example` documents the shape.
Nothing secret in code, logs, or commits.

## Linting
Linting is centralized at the repo root using a single flat config
(`eslint.config.mjs`). Run it with `pnpm lint` (or `pnpm verify` for the full
gate). Workspaces do not have their own `lint` script. To add a plugin (e.g.
React hooks): `pnpm add -Dw eslint-plugin-react-hooks`, then register it in
`eslint.config.mjs`.
