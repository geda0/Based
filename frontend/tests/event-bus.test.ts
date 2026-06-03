import { describe, it, expect } from "vitest";
import { createEventBus } from "../src/lib/event-bus";

interface AppEvent {
  id: string;
}

describe("createEventBus", () => {
  it("delivers published events to a subscriber in publish order", () => {
    const bus = createEventBus<AppEvent>();
    const received: AppEvent[] = [];

    bus.subscribe((event) => {
      received.push(event);
    });

    const first: AppEvent = { id: "first" };
    const second: AppEvent = { id: "second" };
    bus.publish(first);
    bus.publish(second);

    expect(received).toEqual([first, second]);
  });
});
