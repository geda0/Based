import type { RankedFeed } from '../contracts';

export function ChannelRail(props: { feed: RankedFeed; onSelect?: (eventId: string) => void }): JSX.Element {
  return (
    <ul>
      {props.feed.events.map((event) => (
        <li key={event.eventId}>
          <button type="button" onClick={() => props.onSelect?.(event.eventId)}>
            {event.narrative}
          </button>
          <meter min={0} max={1} value={event.heatDelta} aria-valuenow={event.heatDelta} aria-label="heat" />
        </li>
      ))}
    </ul>
  );
}
