# Architecture

## System shape
A TypeScript monorepo with three workspaces:

```
┌─────────────┐      HTTPS/JSON      ┌──────────────┐      SQL      ┌──────────┐
│  frontend/  │  ───────────────▶    │   backend/   │  ─────────▶   │ Postgres │
│ React + Vite│   (typed API client) │ Fastify API  │  (migrations) │          │
└─────────────┘  ◀───────────────    └──────────────┘               └──────────┘
        ▲                                    │
        │                                    ├── auth (JWT/session)
        │  e2e/ (Playwright) drives the      ├── tenancy (row-level scoping)
        └─ whole stack in a real browser     └── billing (Stripe webhooks)
```

- **frontend/** — React SPA. Talks to the backend only through a typed API
  client. No business rules live here that the backend doesn't also enforce.
- **backend/** — Fastify HTTP API. Owns all business rules, authorization, and
  data access. Organized by feature module under `src/modules/<feature>/`.
- **e2e/** — Playwright tests that exercise FE + BE together against a running
  stack.

The stack choice and its rationale are recorded in `decisions/0002-tech-stack.md`.
Swapping the backend to another language (e.g. Python/FastAPI) is supported by
changing `.claude/tdd.config` and the runbook; the method is unchanged.

## Backend module layout
Each feature is a self-contained module so agents can work on one without
loading the whole codebase:
```
backend/src/modules/<feature>/
  <feature>.routes.ts     # HTTP surface (the contract that tests assert)
  <feature>.service.ts    # business logic
  <feature>.repo.ts       # data access, always tenant-scoped
  <feature>.schema.ts     # request/response validation (zod or similar)
```
Tests assert the **HTTP contract** and the **service behavior**, not the repo
internals.

## Request lifecycle (backend)
1. Request hits a route. Schema validation rejects malformed input (tested).
2. Auth middleware resolves the principal + tenant from the token (tested:
   missing/invalid token → 401).
3. Authorization checks the principal may act on this resource (tested:
   wrong role / wrong tenant → 403/404).
4. Service executes business logic; repo reads/writes **scoped to the tenant**.
5. Response is serialized through the schema.

## SaaS invariants (these are non-negotiable; prove them with tests)
1. **Multi-tenancy / data isolation.** Every row belongs to a tenant. Every
   query filters by the current tenant. For any new data path, there must be a
   test proving tenant A cannot read or mutate tenant B's data.
2. **Authentication.** No endpoint is reachable without a valid principal unless
   it is explicitly public (and that's tested too).
3. **Authorization (RBAC).** Roles gate actions. Each protected action has a
   test for the allowed role passing and a disallowed role being denied.
4. **Billing integrity.** Subscription state gates feature access. Stripe (or
   other provider) webhooks are **idempotent** — replaying a webhook must not
   double-charge or double-provision. This is tested.
5. **Secrets & config.** All secrets come from environment variables. Nothing
   secret is committed or logged. `.env.example` documents the shape.
6. **Migrations.** Schema changes are forward-only, reviewed, and never edited
   after shipping. A migration ships with the test that depends on it.
7. **Observability.** Errors are logged with a request id and tenant id (never
   with secrets). New endpoints emit structured logs.

## Where to add things
- New API feature → new `backend/src/modules/<feature>/` + tests in
  `backend/tests/`.
- New UI feature → component under `frontend/src/components/` + tests in
  `frontend/tests/`.
- New cross-stack flow → a Playwright spec in `e2e/tests/`.

Always: failing test first (in the right layer), then code. See
`testing-strategy.md` for which layer.
