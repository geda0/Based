# 0002 — Technology stack

## Status
Accepted (revisit per project needs).

## Context
We want one language across the stack to minimize agent context-switching and
keep a single test story, while remaining a realistic SaaS shape.

## Decision
- Monorepo with pnpm workspaces.
- Backend: Fastify + TypeScript; tests via Vitest using `app.inject()` for the
  HTTP contract.
- Frontend: React + TypeScript + Vite; tests via Vitest + React Testing Library.
- E2E: Playwright.
- Data: Postgres (introduced when the first persistent feature lands).

## Consequences
One language, one mental model, fast layer-scoped feedback. Swapping the backend
to another language is supported by editing `.claude/tdd.config` and the runbook;
the pairing method is unaffected.

## Alternatives considered
Python/FastAPI backend (excellent, but adds a second language + toolchain).
Next.js fullstack (couples FE/BE more tightly than we want for clear test layers).
