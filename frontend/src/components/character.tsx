import { useEffect, useState } from 'react';
import type { HostDirective } from '../contracts';

export function Character(props: {
  directive?: HostDirective;
  speak?: (text: string) => void;
  speakingMs?: number;
}): JSX.Element {
  // safety cap — the App's drain-coupled revert governs normal returns to idle;
  // this only fires if speak() never settles (e.g. a hung voice transport).
  const { directive, speak, speakingMs = 30000 } = props;
  // The directive instance we have already auto-reverted to idle. Speaking is
  // derived during render (so a fresh speak directive shows immediately, with no
  // extra flushed state update), then a timer marks this directive reverted so the
  // host falls quiet on its own once the speaking window elapses.
  const [reverted, setReverted] = useState<HostDirective>();
  const speaking = (directive?.action === 'speak' || directive?.action === 'digest') && reverted !== directive;

  useEffect(() => {
    if (directive?.action !== 'speak') return undefined;
    if (directive.utterance && speak) speak(directive.utterance);
    const timer = setTimeout(() => setReverted(directive), speakingMs);
    return () => clearTimeout(timer);
  }, [directive, speak, speakingMs]); // per speak directive: speaks once, arms one revert

  return (
    <div
      className="character-root"
      data-state={speaking ? 'speaking' : 'idle'}
      role="status"
      aria-label={speaking ? 'host speaking' : 'host idle'}
    >
      <div className="host-orb" aria-hidden="true" />
      <div className="host-meta">
        <span className="host-name">Based Host</span>
        <span className="host-status-text">{speaking ? 'speaking' : 'idle'}</span>
        {speaking && directive?.utterance && (
          <p className="host-caption">{directive.utterance}</p>
        )}
      </div>
    </div>
  );
}
