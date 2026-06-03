# Contributing (humans and agents)

- All work is test-first. No production code without a failing test (enforced).
- One behavior per cycle; one logical change per commit (Conventional Commits).
- Respect the SaaS invariants in `docs/architecture.md`; prove them with tests.
- Never weaken or delete a test to make the bar green — raise it instead.
- Update `.claude/state/progress.md` before ending any session.
- Promote durable decisions to `docs/decisions/` as ADRs.
- `pnpm verify` must be green before a feature is considered done.
