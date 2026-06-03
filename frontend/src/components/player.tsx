import type { Vantage } from '../contracts';

export function Player(props: { vantage: Vantage }): JSX.Element {
  return <iframe title="player" src={props.vantage.embedUrl} />;
}
