import { describe, it, expect } from "vitest";
import { createEventBus } from "../src/lib/event-bus";
describe("createEventBus", () => {
    it("delivers published events to a subscriber in publish order", () => {
        const bus = createEventBus();
        const received = [];
        bus.subscribe((event) => {
            received.push(event);
        });
        const first = { id: "first" };
        const second = { id: "second" };
        bus.publish(first);
        bus.publish(second);
        expect(received).toEqual([first, second]);
    });
});
