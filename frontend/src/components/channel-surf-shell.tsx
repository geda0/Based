import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { HostDirective, PerceptionEvent, RankedFeed, Vantage } from '../contracts';
import { Player } from './player';
import { ChannelRail } from './channel-rail';

function topVantage(event: PerceptionEvent): Vantage {
  return event.vantages.reduce((best, v) => (v.lensScore > best.lensScore ? v : best));
}

export function ChannelSurfShell(props: {
  feed: RankedFeed;
  directive?: HostDirective;
  hostPresence?: ReactNode;
  cta?: ReactNode;
}): JSX.Element {
  const { feed, directive, hostPresence, cta } = props;
  // M1 mock guarantees a non-empty feed (no empty-state required yet); index 0 is the top-ranked event.
  // Non-null assertion narrows away the `undefined` from noUncheckedIndexedAccess.
  const [current, setCurrent] = useState<Vantage>(topVantage(feed.events[0]!));

  useEffect(() => {
    if (directive?.action === 'cutTo' && directive.cutToVantage) {
      const v = feed.events
        .flatMap((e) => e.vantages)
        .find((vantage) => vantage.streamId === directive.cutToVantage!.streamId);
      if (v) setCurrent(v);
    }
  }, [directive, feed]);

  return (
    <div className="surf-shell">
      <div className="surf-player-col">
        <div className="surf-player-frame">
          <Player vantage={current} />
          {cta}
        </div>
        {hostPresence && (
          <div className="host-presence-bar">
            {hostPresence}
          </div>
        )}
      </div>
      <aside className="surf-rail-col" aria-label="Channel rail">
        <div className="rail-heading">Live channels</div>
        <ChannelRail
          feed={feed}
          onSelect={(eventId) => {
            const ev = feed.events.find((e) => e.eventId === eventId);
            if (ev) setCurrent(topVantage(ev));
          }}
        />
      </aside>
    </div>
  );
}
