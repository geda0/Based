<!-- >>> tdd-pairing: managed (refreshed on update; do not edit) >>> -->
# AGENTS.md - start here, every agent, every session

This project is built by **test-driven agent pairing** (the `create-tdd-pairing` kit).
The method is single-sourced in `docs/tdd/` - read it; don't re-document it here.

- **Read first:** `docs/tdd/tdd-workflow.md` (the loop), `docs/tdd/testing-philosophy.md`,
  and `docs/tdd/project-invariants.md` (the rules this project must uphold).
- **Continue prior work** from `.claude/state/progress.md` (+ `design-notes.md`); run the
  suite for ground truth. State lives in files, never memory.
- **Roles:** `test-writer` (one failing test), `implementer` (minimal green), `tdd-critic`
  (read-only audit), the orchestrator (`CLAUDE.md`), and the human navigator.
- **The rails** (hooks): phase is `red`/`green`/`refactor` during a cycle, or `off` for
  manual work - **never empty** (empty fails closed). Edits are scoped by layer; you can't
  finish on a red bar. If a hook blocks you, it's doing its job.
<!-- <<< tdd-pairing: managed <<< -->

<!-- Existing content preserved as your project overlay (update never touches below). -->

# AGENTS.md — start here, every agent, every session

This file is the **single entry point** for any AI agent working in this repo —
Claude Code, an SDK-driven agent, or any other tool. If you read nothing else
first, read this. It tells you what the project is, how work is done here, and
**how to continue work someone (or some agent) started before you**.

> Claude Code users: `CLAUDE.md` is loaded automatically and points back here.
> Other tools: load this file at session start.

---

## 1. What this project is
A full-stack **SaaS** application built as a TypeScript monorepo:
- `backend/`  — Fastify + TypeScript HTTP API (the BE).
- `frontend/` — React + TypeScript + Vite SPA (the FE).
- `e2e/`      — Playwright end-to-end tests across FE+BE.

It is developed **exclusively by test-driven pairing between agents.** No
production code is written without a failing test demanding it. This is not a
style preference here — it is enforced by hooks (see §5).

## 2. How work is done here (the method in one paragraph)
Two agents pair, ping-pong style. The **test-writer** writes ONE failing test
for the next behavior (RED). The **implementer** writes the MINIMAL code to make
it pass (GREEN). Either may then clean up while tests stay green (REFACTOR). A
**tdd-critic** audits test quality every few cycles. An **orchestrator** (the
main session) runs the loop, never writing code itself. Above this inner loop a
**product-owner** owns the backlog and turns the brief into features + acceptance
criteria, an **architect** owns the §6 contract seams + ADRs, and a **qa-verifier**
drives the running app to confirm experience-level acceptance. At each milestone
boundary a **project-manager** (with **dev-ops**) commits, git-tags, and deploys the
milestone to staging. The human **navigator** is the final authority. The agents
coordinate **through the test suite and the files — never through chat.** Full detail:
`docs/tdd-workflow.md`.

## 3. Required reading order (do this before touching anything)
1. **This file** (you're here).
2. `docs/00-START-HERE.md` — the map of all docs.
3. `.claude/state/progress.md` — **what is the current state of work?** (§4)
4. `.claude/state/design-notes.md` — intent for the feature in flight; and
   `.claude/state/backlog.md` — the product-owner's prioritized roadmap.
5. `docs/architecture.md` — the system shape (and ADR `docs/decisions/0003-*` for the
   Based invariants that supersede the SaaS concerns for the prototype).
6. `docs/testing-strategy.md` — what to test at each layer (BE / FE / e2e).
7. `docs/conventions.md` — code, naming, commit, and branch rules.
8. `CLAUDE.md` (if you are the orchestrator) — the exact loop you run.

## 4. How to continue prior work (the continuation contract)
State that must survive across sessions and across different agents lives in
files, because every agent starts with a fresh context window. Three files carry
it:

| File | Answers | Who updates it |
|------|---------|----------------|
| `.claude/state/progress.md`     | What's done, what's next, current phase/layer, blockers | orchestrator, every cycle |
| `.claude/state/backlog.md`      | Prioritized features, acceptance criteria, decisions-needed | product-owner |
| `.claude/state/design-notes.md` | Feature goal, acceptance checklist, decisions | product-owner, per feature |
| `.claude/state/releases.md`     | Per-milestone commit / tag / deploy record | project-manager |
| `docs/decisions/*.md` (ADRs)    | Why we chose X (durable, never deleted) | architect / whoever makes the call |

**To resume work:** read `progress.md` → it names the current feature, the
acceptance bullet in flight, the phase (red/green/refactor) and layer
(backend/frontend/e2e), and any blocker. Run the suite (`pnpm verify`) to learn
ground truth. Then re-enter the loop at the recorded phase. Never assume memory;
the files and the green/red bar are the only truth.

**Before you end a session,** you MUST update `progress.md` so the next agent can
pick up cleanly. Leave the repo on a green bar if at all possible; if you must
stop mid-cycle, record exactly where and why.

## 5. The rails you cannot go around
Hooks in `.claude/settings.json` enforce the method (see `docs/tdd-workflow.md`):
- You may not edit production code during the `red` phase.
- You may not edit test files during the `green` phase. **Never weaken a test to
  get green.** If a test seems wrong, stop and raise it — that's a human/navigator
  decision.
- You may not finish a turn with a failing suite when the phase is green/refactor.
- One failing test per red step. No batching.

If a hook blocks you, it is doing its job — read its message and comply, don't
try to route around it.

## 6. Commands you'll actually use
```bash
pnpm install            # once, after clone
pnpm verify             # typecheck + lint + full test suite (the truth)
pnpm test:backend       # fast BE-only feedback
pnpm test:frontend      # fast FE-only feedback
pnpm test:e2e           # Playwright end-to-end
pnpm dev                # run FE + BE locally
```
Full environment setup (DB, env vars, ports) is in `docs/runbook.md`.

## 7. SaaS rules you must never silently violate
> **Prototype note:** per ADR `docs/decisions/0003-based-prototype-scope.md`, the Based
> prototype replaces these with the **Based invariants** — spoiler-safety, silence
> budget, contracts-as-seam, cost-gating, official-embeds-only, secrets-from-env. The
> SaaS rules below are the deferred production target.

These are detailed in `docs/architecture.md`; the headline rules:
- **Tenant isolation:** every data access is scoped to a tenant. A test must
  prove cross-tenant access is impossible for any new data path.
- **AuthN/AuthZ:** no endpoint ships without tests for unauthenticated and
  unauthorized access.
- **No secrets in code or logs.** Config comes from env (`.env`, never committed).
- **Migrations are forward-only and reviewed.** Never edit a shipped migration.
- **Money/billing logic is always tested**, including idempotency of webhooks.

When in doubt, write the test that proves the rule holds, then implement.
