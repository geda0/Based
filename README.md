# SaaS TDD Agent Repo

A full-stack **SaaS** scaffold (React frontend + Fastify backend + Playwright
e2e, TypeScript monorepo) designed to be built **by AI agents using test-driven
pairing**, with everything an agent needs to pick it up cold and continue.

## For agents
**Read [`AGENTS.md`](./AGENTS.md) first.** It is the universal entry point: the
method, the rails, and the contract for continuing prior work. Claude Code also
auto-loads [`CLAUDE.md`](./CLAUDE.md) (the orchestrator's loop).

## For humans
1. `pnpm install`
2. `cp .env.example .env` and fill local values.
3. `pnpm verify` — typecheck + lint + all tests (the skeleton ships green).
4. To build a feature, fill in [`KICKOFF.md`](./KICKOFF.md) and paste it to the
   orchestrator (interactive) or drive it via the Claude Code SDK.

## How it works (one paragraph)
Two agents pair ping-pong style: a **test-writer** writes one failing test
(RED), an **implementer** writes minimal code to pass it (GREEN), and either
cleans up while green (REFACTOR). A **tdd-critic** audits quality every few
cycles; an **orchestrator** runs the loop and writes no code. They coordinate
through the suite and the files, not chat. Claude Code **hooks** enforce the
discipline by phase × layer — you can't edit source in red, can't edit tests in
green, and can't finish on a red bar. Full method in
[`docs/tdd-workflow.md`](./docs/tdd-workflow.md).

## Layout
```
AGENTS.md            universal agent onboarding + continuation contract
CLAUDE.md            orchestrator protocol (the loop)
KICKOFF.md           prompt to start a feature
docs/                architecture, testing strategy, conventions, runbook, ADRs
.claude/             agents, hooks (the referee), tdd.config, state/
backend/             Fastify + TS API  (layer: backend)
frontend/            React + TS + Vite (layer: frontend)
e2e/                 Playwright        (layer: e2e)
```

## State that lets any agent continue
- `.claude/state/progress.md` — what's done, what's next, current phase/layer.
- `.claude/state/design-notes.md` — the feature in flight.
- `docs/decisions/` — durable ADRs (the "why").

## Caveat
Claude Code hook event names, exit-code semantics, and JSON field paths shift
between releases. Before relying on the gates, confirm them against the current
hooks reference (code.claude.com/docs/en/hooks) and run one dry cycle with
verbose output to watch the hooks fire.
