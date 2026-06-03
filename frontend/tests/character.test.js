import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Character } from "../src/components/character";
describe("Character", () => {
    it("renders idle and stays silent when there is no active directive", () => {
        // The injected speaker seam — a spy that records every utterance it is asked to voice.
        // Tests always inject this so the component never reaches for the real Web Speech global.
        const calls = [];
        const spy = (text) => calls.push(text);
        // No directive at all, and an explicit idle directive: both are the resting case.
        // Idle is the default, so neither should drive the character to speak.
        const idle = { action: "idle", spoilerSafe: true };
        const { rerender } = render(_jsx(Character, { speak: spy }));
        // Observable resting state: the host's status reads "idle", never "speaking".
        const statusNoDirective = screen.getByRole("status");
        expect(statusNoDirective).toHaveTextContent(/idle/i);
        expect(statusNoDirective).not.toHaveTextContent(/speaking/i);
        // An explicit idle directive is the same resting behavior, not a special case.
        rerender(_jsx(Character, { directive: idle, speak: spy }));
        const statusIdleDirective = screen.getByRole("status");
        expect(statusIdleDirective).toHaveTextContent(/idle/i);
        expect(statusIdleDirective).not.toHaveTextContent(/speaking/i);
        // Silence budget: with nothing to say, the character never calls speak.
        expect(calls).toEqual([]);
    });
});
