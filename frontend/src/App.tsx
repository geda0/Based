import { useEffect, useState } from 'react';
import type { HostDirective, PerceptionEvent, RankedFeed } from './contracts';
import { events } from './mocks/event-graph';
import { ChannelSurfShell } from './components/channel-surf-shell';
import { Character } from './components/character';
import { createEventBus } from './lib/event-bus';
import { createSourceGraphFeed } from './lib/source-graph-feed';
import { createHostLoop } from './lib/host-loop';
import { createNarrateClient, type NarrateClient } from './lib/narrate-client';
import { createNarratingHostLoop } from './lib/narrating-host-loop';
import { createLiveNarrator, type VoiceNarrator } from './lib/live-narrator';
import { createOpenRelay } from './lib/live-relay-client';
import { createAudioSink } from './lib/audio-sink';

// M1 placeholder ranking: eventScore = heatDelta (real ranker = M4). Mock is already heat-desc.
const feed: RankedFeed = { events: events.map((e) => ({ ...e, eventScore: e.heatDelta })) };
const defaultNarrate = createNarrateClient(); // stable module-level identity (D1: avoids per-render client churn)
const defaultVoice: VoiceNarrator = {
  speak: (text) =>
    new Promise<void>((resolve) => {
      const synth = typeof window === "undefined" ? undefined : window.speechSynthesis;
      if (!synth) { resolve(); return; }
      const u = new SpeechSynthesisUtterance(text);
      u.onend = () => resolve();
      synth.speak(u);
    }),
};
// Live Gemini-audio voice, gated behind VITE_LIVE_VOICE (off by default). Both
// edges are lazy/on-call (no AudioContext or network touched here), so building
// this at module load is safe even when the flag is unset (ADR 0007 LV1).
const liveVoice: VoiceNarrator = createLiveNarrator({
  openRelay: createOpenRelay(),
  audio: createAudioSink(),
});

export function App(props?: { narrate?: NarrateClient; voice?: VoiceNarrator }): JSX.Element {
  const [speakDirective, setSpeakDirective] = useState<HostDirective>();
  const [cutDirective, setCutDirective] = useState<HostDirective>();
  const narrate = props?.narrate ?? defaultNarrate;
  const voice = props?.voice ?? (import.meta.env.VITE_LIVE_VOICE ? liveVoice : defaultVoice);

  useEffect(() => {
    const bus = createEventBus<PerceptionEvent>();
    const loop = createHostLoop();
    const nloop = createNarratingHostLoop(loop, narrate);
    const unsubscribe = bus.subscribe((event) => {
      void (async () => {
        // M2 placeholder score = heatDelta; M4 swaps in the real ranker.
        const directives = await nloop.onEvent({ ...event, eventScore: event.heatDelta });
        for (const d of directives) {
          if (d.action === 'speak') {
            setSpeakDirective(d);
            const revertIfCurrent = () =>
              setSpeakDirective((cur) => (cur === d ? { action: "idle", spoilerSafe: true } : cur));
            void voice.speak(d.utterance ?? "").then(revertIfCurrent, revertIfCurrent);
          } else if (d.action === 'cutTo') setCutDirective(d);
        }
      })();
    });
    const sourceFeed = createSourceGraphFeed(events, bus);
    sourceFeed.start();
    return () => {
      sourceFeed.stop();
      unsubscribe();
    };
  }, [narrate, voice]);

  return (
    <main>
      <Character directive={speakDirective} />
      <ChannelSurfShell feed={feed} directive={cutDirective} />
    </main>
  );
}
