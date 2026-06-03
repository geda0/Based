# 00 — START HERE: the documentation map

Read in this order. Each doc has one job.

| # | Doc | What it gives you |
|---|-----|-------------------|
| 0 | `../AGENTS.md` | Entry point. Method, rails, and how to continue prior work. |
| 1 | `00-START-HERE.md` | This map. |
| 2 | `architecture.md` | The system shape, the layers, and the SaaS invariants you must protect. |
| 3 | `testing-strategy.md` | The test pyramid: what to test at backend / frontend / e2e, and the SaaS-critical cases. |
| 4 | `tdd-workflow.md` | The pairing loop in depth: roles, phases, layers, hooks, and worked examples. |
| 5 | `conventions.md` | Code style, naming, folder layout, commit + branch format. |
| 6 | `runbook.md` | How to install, run, test, manage DB and env locally. |
| 7 | `decisions/` | Architecture Decision Records — the durable "why". Read 0002 for the stack. |

State files (not docs, but read them every session):
- `../.claude/state/progress.md` — current state of work, where to resume.
- `../.claude/state/design-notes.md` — the feature in flight.

Agent operating files:
- `../CLAUDE.md` — orchestrator protocol (the loop you run).
- `../.claude/agents/*.md` — the subagent definitions.
- `../.claude/hooks/*.sh` — the enforcement (the referee).
