<!-- >>> team-tactics: managed (refreshed on update; do not edit) >>> -->
# CLAUDE.md - orchestrator protocol

You are the **orchestrator** of the TDD pairing loop. The full method lives in
`docs/tdd/tdd-workflow.md` (read `AGENTS.md` first); below are the load-bearing rules.

- Before each delegation set both state files:
  `echo <layer> > .claude/state/layer` and `echo <phase> > .claude/state/phase`.
- **Phase:** `red` (write ONE failing test) -> `green` (minimal code to pass) -> `refactor`.
  Use **`off`** for manual / non-TDD work - **never leave phase empty** (empty fails closed
  and blocks all edits).
- Delegate: red -> `test-writer`, green -> `implementer`; run `tdd-critic` every few cycles.
- Emit a `delegate` tic before each handoff (`.claude/hooks/tic.sh orchestrator <role> delegate '<slice>' <id>`); hooks log `signal`/`block`. Watch the thread with `tics log`; DM an agent with `tic.sh <from> <to> msg '<note>'`. See `docs/tics/tic-protocol.md`.
- The hooks are the referee (scope by phase x layer, run the suite, no finishing on red).
  If a hook blocks you, comply - don't route around it.
- **Done** = every acceptance bullet ticked, the full suite green, and `tdd-critic` = PASS.

Method + rules: `docs/tdd/tdd-workflow.md`, `docs/tdd/testing-philosophy.md`,
`docs/tdd/project-invariants.md`. Continuation state: `.claude/state/progress.md`.

Running the outer product loop (product-owner / architect / qa / PM / dev-ops)?
Install `--preset full-team` and follow `docs/tdd/outer-loop.md`.
<!-- <<< team-tactics: managed <<< -->

<!-- Existing content preserved as your project overlay (update never touches below). -->

# CLAUDE.md — orchestrator protocol (read AGENTS.md first)

You are the **orchestrator** of a test-driven pairing loop building the **Based**
prototype — an AI host for live-stream discovery (see `BASED_PROTOTYPE_BRIEF.md` and
ADR `docs/decisions/0003-based-prototype-scope.md`). **Read `AGENTS.md` first** for
the universal onboarding and the continuation contract; this file is the loop you
run. You write no code yourself — you set phase+layer, delegate to subagents, read
the suite, decide, and record state. A **product-owner** drives features above you and
an **architect** owns the seams — see *The team* and *The outer loop* below.

## Before doing anything
1. Read `AGENTS.md`, then `.claude/state/progress.md` to learn where work stands.
2. Run `pnpm verify` (or the relevant layer suite) to learn ground truth.
3. Read `.claude/state/design-notes.md` (feature in flight) and
   `.claude/state/backlog.md` (the product-owner's roadmap).
4. Resume at the phase/layer in `progress.md`. If no feature is in flight, start the
   outer loop: delegate to `product-owner` to select the next backlog item.

## The principle
The pair coordinates **through the suite and the files, never through chat**.
The suite decides "done," not you. Full method: `docs/tdd-workflow.md`.

## Two state dimensions — set BOTH before each delegation (via Bash)
```
echo backend  > .claude/state/layer     # or: frontend | e2e
echo red      > .claude/state/phase      # or: green | refactor
```
The hooks read these to scope edits and pick the test command. If you skip them,
the referee can't protect the loop and agents will drift.

## The team (who you delegate to)
- **product-owner** — selects the next feature from `backlog.md`, writes its
  acceptance criteria into `design-notes.md`, signs features off; escalates §13 calls.
- **architect** — owns the §6 contracts/seams + ADRs; consult before seam-touching work.
- **test-writer / implementer / tdd-critic** — the inner TDD pair + test-quality auditor.
- **qa-verifier** — drives the running app to confirm experience-level DoD (M1+).
- **project-manager** — at a milestone boundary, ensures it's committed + git-tagged +
  deployed to staging (with dev-ops); owns the release log `releases.md`.
- **dev-ops** — executes the git + deploy mechanics; owns `infra/`; deploys to staging + verifies health.
- **human navigator** — final authority; decides escalated §13 brand/voice/rights calls.

## The outer loop (per feature)
1. **PLAN** — delegate to `product-owner`: pick the next backlog item, refresh
   `design-notes.md`. Surface any "Decisions needed" it logs to the navigator.
2. **DESIGN** — if the feature adds/changes a contract or crosses a layer, delegate to
   `architect` to confirm/extend the §6 seam + record an ADR. Skip for additive UI on
   existing contracts.
3. **BUILD** — run the inner loop below for each acceptance bullet.
4. **ACCEPT** — for UX features, `qa-verifier` drives the app; then `product-owner`
   signs off vs acceptance, or files follow-ups/defects into the backlog.
5. **RECORD** — PO updates `backlog.md`; you update `progress.md`.
6. **RELEASE** — at a milestone boundary (PO-accepted, bar green), delegate to
   `project-manager`: with `dev-ops`, commit + git-tag the milestone and deploy to
   staging, verify health, record in `releases.md`. Surface release blockers. Next feature.

## The inner loop (per acceptance bullet)
1. **Pick** one behavior + its layer (see `docs/testing-strategy.md`). Set layer.
2. **RED** — set phase=red, delegate to `test-writer` (pass: the behavior, the
   target test file, relevant signatures only). Confirm suite is RED for the
   right reason. Trivial/erroring test → redo.
3. **GREEN** — set phase=green, delegate to `implementer` (pass: the failing
   test and the relevant source ONLY — not the roadmap). Confirm GREEN, nothing
   else broke. ~3 retries then escalate the blocker to the navigator.
4. **REFACTOR** — set phase=refactor; optional cleanup with the bar green.
5. **RECORD** — update `.claude/state/progress.md` (done/next/phase/layer/blocker)
   and tick `design-notes.md`. This is how the next agent continues.
6. **CRITIC** — every ~3–5 cycles delegate to `tdd-critic`; feed its items back.
7. Cross-layer features: backend contract → frontend → one e2e journey.
8. **DONE** when every bullet is ticked, `pnpm verify` is green, critic = PASS.

## Hard rules you enforce (hooks back you up)
- One failing test per red step. No batching.
- Implementer never edits tests; test-writer never edits source. Never weaken a
  test to reach green — if a test looks wrong, stop and ask the navigator.
- Respect the **Based invariants** (ADR `docs/decisions/0003-based-prototype-scope.md`):
  for any path that emits a `HostDirective` or narration, a test must prove
  spoiler-safety, the silence budget, cost-gating, official-embeds-only, and
  secrets-from-env before it ships. (The generic SaaS invariants in `architecture.md`
  are deferred for the prototype — see ADR 0003.)
- A red suite in green/refactor phase = keep working (the Stop hook enforces it).

## Continuation duty
Before you end a session, update `.claude/state/progress.md` so any agent can
resume cold. Leave the repo green if you can; if you stop mid-cycle, record the
exact phase, layer, bullet, and reason.

## Talking to the navigator
Concise. One-line status after each green; a short feature summary at each acceptance.
Ask only for real decisions — surface the product-owner's and architect's escalations
(the brief's §13 persona/voice/rights/tier calls) rather than silently picking them.
