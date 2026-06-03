# Conventions

## Language & style
- TypeScript everywhere, `strict` on. No `any` without a written reason.
- Prefer pure functions for logic; isolate I/O at the edges (routes, repos).
- Validate all external input with schemas (zod). Never trust client data.

## Folder layout
- Backend features: `backend/src/modules/<feature>/{routes,service,repo,schema}.ts`.
- Frontend: components in `frontend/src/components/`, one folder per nontrivial
  component with its test alongside or in `frontend/tests/`.
- Tests mirror the unit they cover; name by behavior, not number.

## Naming
- Files: kebab-case. Types/Components: PascalCase. Vars/functions: camelCase.
- Tests: `it('does X when Y')` — observable behavior.

## Commits (Conventional Commits)
`type(scope): summary`, e.g. `feat(billing): reject replayed stripe webhook`.
Types: feat, fix, refactor, test, docs, chore. One logical change per commit.
A red→green→refactor cycle is typically one `test:` + one `feat:`/`fix:` commit,
or a single `feat:` commit that includes both the test and the code.

## Branches
`feat/<short-name>`, `fix/<short-name>`. Keep them small; one feature per branch.

## Definition of done
Every acceptance bullet ticked, `pnpm verify` green, the SaaS invariants for any
touched data path proven by tests, `progress.md` updated, critic returns PASS.

## Swapping the backend language
The method is language-agnostic. To use Python/FastAPI instead of Fastify:
update `.claude/tdd.config` (BE_TEST_CMD=`pytest -q`, BE globs), the runbook, and
ADR 0002. Frontend, hooks, agents, and the loop are unchanged.
