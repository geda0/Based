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
