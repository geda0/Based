import type { Vantage } from '../contracts';

function embedSrc(embedUrl: string): string {
  try {
    const url = new URL(embedUrl);
    // Twitch player embeds REQUIRE &parent=<host> or they refuse to render ([NoParent]).
    // Append the runtime host (env-correct), preserving the official source/channel/path.
    if (url.hostname === 'player.twitch.tv' && !url.searchParams.has('parent')) {
      url.searchParams.append('parent', window.location.hostname);
      return url.toString();
    }
  } catch {
    // Not a parseable absolute URL — render as-is.
  }
  return embedUrl;
}

export function Player(props: { vantage: Vantage }): JSX.Element {
  return <iframe title="player" src={embedSrc(props.vantage.embedUrl)} />;
}
