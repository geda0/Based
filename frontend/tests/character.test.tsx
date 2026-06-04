import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Character } from "../src/components/character";
import type { HostDirective } from "../src/contracts";

describe("Character", () => {
  afterEach(() => {
    // Some tests swap in fake timers; restore real timers so the others are unaffected.
    vi.useRealTimers();
  });

  it("renders idle and stays silent when there is no active directive", () => {
    // The injected speaker seam — a spy that records every utterance it is asked to voice.
    // Tests always inject this so the component never reaches for the real Web Speech global.
    const calls: string[] = [];
    const spy = (text: string) => calls.push(text);

    // No directive at all, and an explicit idle directive: both are the resting case.
    // Idle is the default, so neither should drive the character to speak.
    const idle: HostDirective = { action: "idle", spoilerSafe: true };

    const { rerender } = render(<Character speak={spy} />);

    // Observable resting state: the host's status reads "idle", never "speaking".
    const statusNoDirective = screen.getByRole("status");
    expect(statusNoDirective).toHaveTextContent(/idle/i);
    expect(statusNoDirective).not.toHaveTextContent(/speaking/i);

    // An explicit idle directive is the same resting behavior, not a special case.
    rerender(<Character directive={idle} speak={spy} />);
    const statusIdleDirective = screen.getByRole("status");
    expect(statusIdleDirective).toHaveTextContent(/idle/i);
    expect(statusIdleDirective).not.toHaveTextContent(/speaking/i);

    // Silence budget: with nothing to say, the character never calls speak.
    expect(calls).toEqual([]);
  });

  it("speaks the utterance exactly once on a speak directive, then returns to idle", () => {
    // Spy speaker seam: records every utterance the character asks to voice.
    const calls: string[] = [];
    const speak = (text: string) => calls.push(text);

    const speakDirective: HostDirective = {
      action: "speak",
      utterance: "listen — eyes on the Major",
      spoilerSafe: true,
    };

    const { rerender } = render(
      <Character directive={speakDirective} speak={speak} />,
    );

    // Observable speaking state: the host's status reads "speaking".
    const speakingStatus = screen.getByRole("status");
    expect(speakingStatus).toHaveTextContent(/speaking/i);

    // Cost-gating: a speak directive voices its utterance exactly once, with that text.
    expect(calls).toEqual(["listen — eyes on the Major"]);

    // A following idle directive returns the character to rest — and does not speak again.
    const idle: HostDirective = { action: "idle", spoilerSafe: true };
    rerender(<Character directive={idle} speak={speak} />);

    const idleStatus = screen.getByRole("status");
    expect(idleStatus).toHaveTextContent(/idle/i);
    expect(idleStatus).not.toHaveTextContent(/speaking/i);

    // The idle render must not trigger another utterance: still exactly one call.
    expect(calls).toEqual(["listen — eyes on the Major"]);
  });

  it("renders a digest directive as speaking and shows its caption", () => {
    // The digest is the host's "while you were gone" catch-up — a spoken beat, so the
    // character must treat action:'digest' the same as a speak: visibly speaking, with
    // the catch-up utterance shown as the caption. (character.tsx was widened so
    // 'digest' counts as speaking; only 'speak'/'idle' were covered before.)
    const utterance = "Catching you up — a major semifinal is live";
    const digestDirective: HostDirective = {
      action: "digest",
      utterance,
      spoilerSafe: true,
    };

    render(<Character directive={digestDirective} />);

    // Observable speaking state: status reads "speaking" with the speaking aria-label.
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/speaking/i);
    expect(status).toHaveAttribute("aria-label", "host speaking");

    // The catch-up line is shown as the on-screen caption while speaking.
    expect(status).toHaveTextContent(utterance);
  });

  it("returns to idle on its own a short time after speaking, without a follow-up idle directive", async () => {
    // In the wired app nothing sends an idle after a speak, so the host must un-stick
    // itself: voice its line, then fall quiet once the speaking window elapses.
    vi.useFakeTimers();

    const speak = (): void => {};

    const speakDirective: HostDirective = {
      action: "speak",
      utterance: "listen — eyes on X",
      spoilerSafe: true,
    };

    // A small explicit window keeps the auto-revert deterministic under fake timers.
    render(<Character directive={speakDirective} speak={speak} speakingMs={1000} />);

    // Precondition: speaking immediately on the speak directive.
    expect(screen.getByRole("status")).toHaveTextContent(/speaking/i);

    // Advance past the speaking window; advancing inside act flushes the state update.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Auto-revert: the host is idle again even though no idle directive was sent.
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/idle/i);
    expect(status).not.toHaveTextContent(/speaking/i);
  });
});
