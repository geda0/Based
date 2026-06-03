import type { RankedFeed } from '../contracts';
import { topVantage } from '../lib/top-vantage';

export function ChannelRail(props: { feed: RankedFeed; onSelect?: (eventId: string) => void }): JSX.Element {
  return (
    <ul className="channel-rail-list">
      {props.feed.events.map((event) => {
        // ADR 0009 — the rail is viewer-facing, so its label must come from SAFE fields
        // (`event.type` + the top vantage's `streamer`), never the outcome-bearing narrative.
        const streamer = topVantage(event).streamer;
        const label = streamer ? `${event.type} · ${streamer}` : event.type;
        return (
          <li key={event.eventId} className="channel-card">
            <button type="button" className="channel-card-btn" onClick={() => props.onSelect?.(event.eventId)}>
              {label}
            </button>
            <div className="heat-row">
              <span className="heat-icon" aria-hidden="true">🔥</span>
              <meter
                className="heat-bar"
                min={0}
                max={1}
                value={event.heatDelta}
                aria-valuenow={event.heatDelta}
                aria-label="heat"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
