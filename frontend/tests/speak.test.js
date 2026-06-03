import { describe, it, expect } from "vitest";
import { createSpeak } from "../src/lib/speak";
describe("createSpeak", () => {
    it("forwards each text to the injected speaker in call order", () => {
        const spoken = [];
        const speak = createSpeak((text) => {
            spoken.push(text);
        });
        speak("listen — eyes on the Major");
        speak("the round is about to pop");
        expect(spoken).toEqual([
            "listen — eyes on the Major",
            "the round is about to pop",
        ]);
    });
});
