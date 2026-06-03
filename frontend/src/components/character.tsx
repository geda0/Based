import { useEffect, useState } from 'react';
import type { HostDirective } from '../contracts';

export function Character(props: {
  directive?: HostDirective;
  speak?: (text: string) => void;
  speakingMs?: number;
}): JSX.Element {
  const { directive, speak, speakingMs = 4000 } = props;
  // The directive instance we have already auto-reverted to idle. Speaking is
  // derived during render (so a fresh speak directive shows immediately, with no
  // extra flushed state update), then a timer marks this directive reverted so the
  // host falls quiet on its own once the speaking window elapses.
  const [reverted, setReverted] = useState<HostDirective>();
  const speaking = directive?.action === 'speak' && reverted !== directive;

  useEffect(() => {
    if (directive?.action !== 'speak') return undefined;
    if (directive.utterance && speak) speak(directive.utterance);
    const timer = setTimeout(() => setReverted(directive), speakingMs);
    return () => clearTimeout(timer);
  }, [directive, speak, speakingMs]); // per speak directive: speaks once, arms one revert

  return (
    <div role="status" aria-label={speaking ? 'host speaking' : 'host idle'}>
      {speaking ? 'speaking' : 'idle'}
    </div>
  );
}
