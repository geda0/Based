import { useEffect, useMemo, useState } from 'react';
import type { HostDirective, PerceptionEvent } from './contracts';
import { events as mockEvents, digest } from './mocks/event-graph';
import { type SourceRegistry } from './lib/sources';
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
import { rankFeed, computeEventScore } from './lib/ranker';

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

export function App(props?: { narrate?: NarrateClient; voice?: VoiceNarrator; registry?: SourceRegistry }): JSX.Element {
  const [speakDirective, setSpeakDirective] = useState<HostDirective>();
  const [cutDirective, setCutDirective] = useState<HostDirective>();
  const [started, setStarted] = useState(false);
  const narrate = props?.narrate ?? defaultNarrate;
  const voice = props?.voice ?? (import.meta.env.VITE_LIVE_VOICE ? liveVoice : defaultVoice);
  const registry = props?.registry;

  const [events, setEvents] = useState<PerceptionEvent[]>(registry ? [] : mockEvents);
  useEffect(() => {
    if (!registry) return;
    let alive = true;
    void registry.fetchAll().then((evs) => { if (alive) setEvents(evs); });
    return () => { alive = false; };
  }, [registry]);

  const feed = useMemo(() => rankFeed(events), [events]);

  useEffect(() => {
    const bus = createEventBus<PerceptionEvent>();
    const loop = createHostLoop({ silenceBudgetMs: 12000 });
    const nloop = createNarratingHostLoop(loop, narrate);
    const unsubscribe = bus.subscribe((event) => {
      void (async () => {
        const directives = await nloop.onEvent({ ...event, eventScore: computeEventScore(event) });
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
    if (started) {
      if (digest) {
        const d: HostDirective = { action: 'digest', utterance: digest, spoilerSafe: true };
        setSpeakDirective(d);
        const revertIfCurrent = () =>
          setSpeakDirective((cur) => (cur === d ? { action: 'idle', spoilerSafe: true } : cur));
        void voice.speak(digest).then(revertIfCurrent, revertIfCurrent);
      }
      sourceFeed.start();
    }
    return () => {
      sourceFeed.stop();
      unsubscribe();
    };
  }, [narrate, voice, started, events]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-wordmark">Based</span>
        <span className="app-tagline">Your AI host for live discovery</span>
      </header>
      <main className="app-stage">
        {feed.events.length > 0
          ? <ChannelSurfShell
              feed={feed}
              directive={cutDirective}
              hostPresence={<Character directive={speakDirective} />}
              cta={
                !started ? (
                  <div className="cta-overlay">
                    <p className="cta-tagline">Your AI host is ready — press play</p>
                    <button className="cta-btn" onClick={() => setStarted(true)}>▶ Start watching</button>
                  </div>
                ) : null
              }
            />
          : <div aria-label="loading feed" />}
      </main>
    </div>
  );
}
