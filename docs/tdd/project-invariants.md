# Project invariants — Based prototype

Rules every change must uphold. The **test-writer** proves them, the **implementer**
honors them, the **tdd-critic** checks their coverage. Authority: ADR 0003 (scope +
invariant remap) — these REPLACE the generic SaaS invariants for the prototype.

> Any path that **emits a `HostDirective` or narration** must prove the relevant rules
> below with a test before it ships.

1. **Spoiler-safety.** Every `HostDirective` is `spoilerSafe: true` (compiler-enforced
   literal). The host never names an outcome before the cut lands; generated lines are
   anticipation-only and tier-hedged (ADR 0006). On-screen surfaces (e.g. the rail) must
   not leak outcomes either.
2. **Silence budget.** Idle is the default; speaking/sessions are rate-limited and
   threshold-gated — a burst of events is NOT a burst of speech. A failed/empty narration
   degrades to silence, never forced noise.
3. **Cost-gating.** The LLM / live session fires ONLY on a surfacing (heat-gated) event —
   zero on idle, never on a poll/timer; bounded per surface.
4. **Secrets from env.** `GEMINI_API_KEY` is read only from the backend env; never accepted
   from a request body, never logged, never returned, never in the client bundle.
   (Staging: SSM SecureString -> App Runner.)
5. **Official embeds only / route value to the source.** Render the provided `embedUrl`
   verbatim (iframe `src`); never rehost or rewrite; surface originals over re-streamers.
6. **Contracts-as-seam.** The UI consumes only `RankedFeed` + `HostDirective` (+ injected
   speak/narrate interfaces). Swapping the mock feed or the narration transport must not
   reshape the character / player / host-loop. The §6 types live in `frontend/src/contracts/`.

Out of scope (ADR 0003): auth, accounts, persistence, multi-tenancy, billing.
