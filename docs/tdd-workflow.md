# TDD pairing workflow (in depth)

This is the method the whole repo is built around. The orchestrator runs it; the
hooks enforce it; the docs above tell you what to build.

## The principle
The pair coordinates **through the test suite and the files, never through
chat**. Every handoff is gated by an objective signal — the suite is RED or
GREEN. No agent decides "this looks done." The suite decides.

## Roles
- **orchestrator** (main session, `CLAUDE.md`): runs the loop, sets phase+layer,
  delegates, reads results, updates state. Writes no code.
- **test-writer** (`.claude/agents/test-writer.md`): one failing test (RED).
- **implementer** (`.claude/agents/implementer.md`): minimal code to GREEN.
- **tdd-critic** (`.claude/agents/tdd-critic.md`): read-only quality audit.
- **product-owner** (`.claude/agents/product-owner.md`): owns the backlog; turns the
  brief into features + acceptance criteria; selects what's next; signs off acceptance.
- **architect** (`.claude/agents/architect.md`): owns the §6 contract seams + ADRs;
  consulted on seam-touching work.
- **qa-verifier** (`.claude/agents/qa-verifier.md`): drives the running app to confirm
  experience-level DoD (M1+); reports defects, edits nothing.
- **project-manager** (`.claude/agents/project-manager.md`): at a milestone boundary,
  ensures it's committed + git-tagged + deployed to staging (with dev-ops); owns `releases.md`.
- **dev-ops** (`.claude/agents/dev-ops.md`): executes the git + deploy mechanics and owns `infra/`.
- **human navigator**: final authority. Approves the roadmap and resolves the brief's
  §13 product calls (persona, voice, rights, tier-hedging) when escalated.

## Two state dimensions: phase × layer
The orchestrator writes both before each delegation. The hooks read them.

**Phase** (`.claude/state/phase`):
- `red` — only **test** files (of the current layer) may be edited.
- `green` — only **source** files (of the current layer) may be edited.
- `refactor` — anything in the layer; suite must stay green.

**Layer** (`.claude/state/layer`): `backend` | `frontend` | `e2e`.
Selects which test command runs and which globs apply, so feedback is fast and
edits stay in the right workspace.

## The outer loop (per feature)
The product-owner wraps the inner loop:
1. **Plan** — product-owner selects the next backlog item and writes `design-notes.md`.
2. **Design** — if it touches a §6 contract or crosses a layer, the architect confirms/
   extends the seam and records an ADR.
3. **Build** — the inner loop (below) runs each acceptance bullet to green.
4. **Accept** — qa-verifier drives the app for UX features; the product-owner signs off
   against acceptance, or files follow-ups into the backlog.
5. **Record** — backlog + progress updated.
6. **Release** (milestone boundary) — the project-manager, with dev-ops, commits +
   git-tags the accepted milestone and deploys it to staging, verifies health, and logs
   it in `releases.md`. Only on a green bar; never mid-cycle.

Coordination stays through files: `backlog.md` (PO), `design-notes.md` (feature),
contracts + ADRs (architect), `releases.md` (PM). Escalations go to the navigator.

## The inner loop
For each acceptance bullet, in the chosen layer:
1. **Pick** the next behavior (one bullet). Choose the layer (see
   `testing-strategy.md`). `echo <layer> > .claude/state/layer`.
2. **RED.** `echo red > .claude/state/phase`. Delegate to `test-writer` with the
   behavior, the target test file, and the relevant public signatures only. The
   PostToolUse hook runs that layer's suite. Confirm it's RED for the right
   reason (real assertion failure, not an import error). If green → test was
   trivial, redo.
3. **GREEN.** `echo green > .claude/state/phase`. Delegate to `implementer` with
   only the failing test and the relevant source. Confirm the suite goes GREEN
   and nothing previously green broke. ≈3 retries, then escalate the blocker.
4. **REFACTOR.** `echo refactor > .claude/state/phase`. Optional cleanup with the
   bar green; revert if it goes red.
5. **Record.** Update `.claude/state/progress.md` and tick `design-notes.md`.
6. **Repeat.** Every ~3–5 cycles, run `tdd-critic`. When a feature spans layers,
   finish backend contract first, then frontend, then one e2e journey.
7. **Done** when every bullet is ticked, `pnpm verify` is green, and the critic
   returns PASS.

## The hooks (the referee)
Configured in `.claude/settings.json`:
- `guard-edit-scope.sh` (PreToolUse on Edit/Write): blocks out-of-scope edits by
  phase × layer. Blocks editing source in red, tests in green.
- `run-suite.sh` (PostToolUse on Edit/Write): runs the current layer's suite,
  records `green`/`red` to `.claude/state/suite-status`, surfaces failures.
- `require-green-to-stop.sh` (Stop/SubagentStop): refuses to end on a red bar
  when phase is green/refactor.

If a hook blocks you, comply. Routing around the referee defeats the method.

## Worked example (backend)
Behavior: "creating a project requires authentication."
1. layer=backend, phase=red. test-writer adds:
   `it('returns 401 when creating a project without a token')` → asserts
   `app.inject({method:'POST', url:'/projects'})` status is 401. Suite RED.
2. phase=green. implementer adds the auth guard to the route so the call returns
   401. Suite GREEN. Nothing else broke.
3. phase=refactor. Extract the guard into shared middleware; suite stays GREEN.
4. Record progress. Next bullet: "an authenticated user in tenant A cannot see
   tenant B's projects" → another red→green cycle, still backend layer.

## Anti-patterns the critic watches for
- Tests that assert implementation (mock call counts, private state).
- Weakening or deleting a test to force green.
- Over-implementing beyond the failing test.
- e2e tests doing work that belongs in cheaper layers.
- Hardcoded returns never triangulated into real logic.

## Variants
- **Driver/navigator:** one author (implementer) + a navigator/critic steering;
  skip the ping-pong alternation.
- **Two peer sessions:** two Claude Code sessions in separate `git worktree`s on
  a shared branch, using the same `phase`/`layer`/`suite-status` files as the
  lock. Fully symmetric; heavier to operate.
