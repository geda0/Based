<!-- >>> team-tactics: managed (refreshed on update; do not edit) >>> -->
# KICKOFF — your first message to the orchestrator

Pick the path that matches where you are.

## One-shot (you're already in a coding agent)
Paste this — the agent installs team-tactics **and** bootstraps the repo in one go:

```
Install and bootstrap team-tactics in this repo. Run: npx tics .  — then read
AGENTS.md and CLAUDE.md, detect the stack and set LAYERS + the test command(s) in
.claude/tdd.config, and draft docs/tdd/project-invariants.md for my OK. If this is an
existing codebase, adopt it and bring it up to standard (characterization tests, a
green baseline, CI) before new work. Then build with the red->green loop: <what you
want built>.
```

## After `npx tics` (two-step) — paste this as your first message
Read `AGENTS.md` and `CLAUDE.md` first, then set up the harness once:
1. Detect the stack and set `LAYERS` + the test command(s) in `.claude/tdd.config`.
2. Draft `docs/tdd/project-invariants.md` from the codebase for my confirmation.

Then, depending on the repo:

**New project — build a feature:**

FEATURE: <one line — the unit of work you want>

ACCEPTANCE  (each → one or more red→green cycles; tag the layer)
- [<layer>] given … when … then …
- [<layer>] <a project invariant from docs/tdd/project-invariants.md it must prove>

**Existing project — adopt + upgrade to standard:**
- **architect** maps the seams + writes short ADRs; **product-owner** drafts the
  invariants and a backlog (a documented green baseline, characterization tests on the
  load-bearing-but-untested paths, CI), then runs the loop. Never regress the suite.

Set `.claude/state/{layer,phase}` before each step, delegate red→`test-writer` /
green→`implementer`, run `tdd-critic` every ~3 cycles. Done when every bullet is
ticked, the suite is green, and the critic = PASS. (Method: `docs/tdd/tdd-workflow.md`.)
<!-- <<< team-tactics: managed <<< -->

<!-- Existing content preserved as your project overlay (update never touches below). -->

# KICKOFF — paste this (filled in) to start a feature

Run interactively (you are the navigator) or headlessly via the Claude Code SDK.

---

You are the orchestrator. Read AGENTS.md and CLAUDE.md, then follow the TDD
Pairing Protocol exactly.

FEATURE
<plain-language description of the feature / unit of work>

ACCEPTANCE CRITERIA (each becomes one or more red→green cycles; tag the layer)
- [backend]  <observable behavior: given … when … then …>
- [backend]  <SaaS invariant: e.g. tenant A cannot read tenant B's <resource>>
- [frontend] <when the user does X, they see Y>
- [e2e]      <a user can complete journey Z end to end>

CONSTRAINTS / NON-GOALS
- <public API to keep stable, perf bounds, anything off-limits>

INSTRUCTIONS
1. Write/refresh .claude/state/design-notes.md from the above.
2. Begin the loop at the first bullet. Set .claude/state/layer and
   .claude/state/phase before every delegation.
3. Delegate red → test-writer, green → implementer. Run tdd-critic every ~3
   cycles. Order cross-layer work: backend → frontend → e2e.
4. After each green, give me a one-line status. Ask only for real decisions.
5. Update .claude/state/progress.md every cycle.
6. Stop when every bullet is ticked, `pnpm verify` is green, and critic = PASS.

Begin with the first behavior now.
