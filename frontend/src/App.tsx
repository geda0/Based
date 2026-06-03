import { useEffect, useState } from 'react';
import type { HostDirective, PerceptionEvent, RankedFeed } from './contracts';
import { events } from './mocks/event-graph';
import { ChannelSurfShell } from './components/channel-surf-shell';
import { Character } from './components/character';
import { createEventBus } from './lib/event-bus';
import { createSourceGraphFeed } from './lib/source-graph-feed';
import { createHostLoop } from './lib/host-loop';
import { createSpeak } from './lib/speak';
import { createNarrateClient, type NarrateClient } from './lib/narrate-client';
import { createNarratingHostLoop } from './lib/narrating-host-loop';

// M1 placeholder ranking: eventScore = heatDelta (real ranker = M4). Mock is already heat-desc.
const feed: RankedFeed = { events: events.map((e) => ({ ...e, eventScore: e.heatDelta })) };
const speak = createSpeak(); // defaults to Web Speech
const defaultNarrate = createNarrateClient(); // stable module-level identity (D1: avoids per-render client churn)

export function App(props?: { narrate?: NarrateClient }): JSX.Element {
  const [speakDirective, setSpeakDirective] = useState<HostDirective>();
  const [cutDirective, setCutDirective] = useState<HostDirective>();
  const narrate = props?.narrate ?? defaultNarrate;

  useEffect(() => {
    const bus = createEventBus<PerceptionEvent>();
    const loop = createHostLoop();
    const nloop = createNarratingHostLoop(loop, narrate);
    const unsubscribe = bus.subscribe((event) => {
      void (async () => {
        // M2 placeholder score = heatDelta; M4 swaps in the real ranker.
        const directives = await nloop.onEvent({ ...event, eventScore: event.heatDelta });
        for (const d of directives) {
          if (d.action === 'speak') setSpeakDirective(d);
          else if (d.action === 'cutTo') setCutDirective(d);
        }
      })();
    });
    const sourceFeed = createSourceGraphFeed(events, bus);
    sourceFeed.start();
    return () => {
      sourceFeed.stop();
      unsubscribe();
    };
  }, [narrate]);

  return (
    <main>
      <Character directive={speakDirective} speak={speak} />
      <ChannelSurfShell feed={feed} directive={cutDirective} />
    </main>
  );
}
