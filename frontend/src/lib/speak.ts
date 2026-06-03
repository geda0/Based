export type Speaker = (text: string) => void;

export function createSpeak(speaker?: Speaker): (text: string) => void {
  // Web Speech is an optional browser surface. When it is absent (older browsers,
  // or a passive effect that flushes after a test has torn the global down), the
  // speaker is a safe no-op rather than throwing — voicing a line must never crash
  // the host.
  const sink: Speaker =
    speaker ??
    ((text) => {
      const synth = typeof window === 'undefined' ? undefined : window.speechSynthesis;
      if (synth) synth.speak(new SpeechSynthesisUtterance(text));
    });
  return (text: string) => sink(text);
}
