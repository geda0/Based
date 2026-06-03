<!-- >>> teamentic: managed (refreshed on update; do not edit) >>> -->
# KICKOFF — your first message to the orchestrator

After installing teamentic and approving the hooks in Claude Code, copy the prompt
below, fill in the FEATURE (and acceptance bullets), and paste it as your **first
message**. The orchestrator sets up the harness, then builds — no files to hand-edit.

---

Read `AGENTS.md` and `CLAUDE.md` first, then:

**Set up the harness (once):**
1. Detect this project's stack and set `LAYERS` + the test command(s) in
   `.claude/tdd.config` (one layer per independently-tested slice); confirm it runs.
2. Draft `docs/tdd/project-invariants.md` from the codebase — the rules this project
   must always uphold — and show me to confirm.

**Then build this feature (red→green loop):**

FEATURE: <one line — the unit of work you want>

ACCEPTANCE  (each → one or more red→green cycles; tag the layer)
- [<layer>] given … when … then …
- [<layer>] <a project invariant from docs/tdd/project-invariants.md it must prove>

CONSTRAINTS / NON-GOALS
- <public API to keep stable, perf bounds, anything off-limits>

Set `.claude/state/{layer,phase}` before each step, delegate red→`test-writer` /
green→`implementer`, run `tdd-critic` every ~3 cycles. Done when every bullet is
ticked, the suite is green, and the critic = PASS. (Method: `docs/tdd/tdd-workflow.md`.)
<!-- <<< teamentic: managed <<< -->

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
