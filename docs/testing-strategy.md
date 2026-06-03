# Testing strategy

The pairing loop is layer-aware. Before each cycle the orchestrator sets the
**layer** (`backend`, `frontend`, or `e2e`) so the right tests run and the right
files are editable. This doc tells you which layer a given behavior belongs in.

## The pyramid (most tests at the bottom)
```
        ╱ e2e ╲          few   — critical user journeys across FE+BE (Playwright)
      ╱─────────╲
    ╱ FE component╲      some  — rendered behavior, user interactions (RTL)
  ╱───────────────╲
 ╱ BE unit + integ. ╲    many  — HTTP contract, services, tenancy, auth (Vitest)
╱─────────────────────╲
```

## Backend (`layer=backend`) — most behavior lives here
Test the **observable contract**, not internals.
- **Integration (preferred):** drive the Fastify app via `app.inject()` and
  assert status codes, bodies, and headers. This is the contract the FE relies
  on. Example: `POST /things` with a valid body returns 201 and the created
  resource.
- **Unit:** pure service/domain logic with no I/O (pricing math, validators,
  state machines).
- **Always test the SaaS invariants for any new endpoint:**
  - unauthenticated → 401,
  - wrong role → 403, wrong tenant → 404/403 (never leak existence),
  - tenant isolation: tenant B cannot see tenant A's rows,
  - input validation: malformed body → 400.
- Do **not** assert private function calls or repo internals — that couples
  tests to implementation and blocks refactoring (the critic will flag it).

## Frontend (`layer=frontend`) — test what the user experiences
Use React Testing Library. Assert **behavior, not markup structure**.
- Render the component, interact as a user (click, type), assert what the user
  sees (text, roles, disabled states).
- Query by accessible role/label, not by test-ids or CSS classes where possible.
- Mock the API client at its boundary; do not hit the real backend in FE tests
  (that's e2e's job).
- Test loading, empty, error, and success states for data-driven components.
- Don't test implementation details (internal state, which hook ran).

## End-to-end (`layer=e2e`) — prove the journeys, sparingly
Playwright against a running FE+BE.
- Reserve for **critical paths**: sign up → log in → core action → see result;
  subscribe → gain access to a gated feature.
- Keep the count low; e2e is slow and flaky-prone. One solid journey beats ten
  brittle ones.
- e2e tests assert outcomes a user could observe, end to end.

## Choosing the layer for a behavior
- "Given this request, the API responds X" → **backend**.
- "When the user does X in the UI, they see Y" → **frontend**.
- "A user can complete journey Z across the app" → **e2e**.
- A new feature usually means: backend contract tests first, then the FE
  component tests, then maybe one e2e journey. Slice it so each cycle is one
  behavior in one layer.

## Test naming
`describe('<unit/endpoint>')` + `it('<observable behavior>')`, e.g.
`it('rejects withdrawal when balance is insufficient')`. Behavior, not numbers.

## The full gate
`pnpm verify` runs typecheck + lint + all layers. A feature is not done until
`verify` is green and the critic returns PASS.
