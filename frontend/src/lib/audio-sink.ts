import type { AudioSink } from './live-narrator';

// The real AudioSink for the live-voice path (the untested I/O edge behind the
// already-tested VoiceNarrator). Gemini Live audio arrives as base64, 16-bit
// signed PCM, mono, 24 kHz, little-endian (`inlineData.data`). We decode each
// chunk to a Web Audio buffer and schedule it gaplessly after the previous one
// so the narrator's drain logic (await Promise.all of every play()) sees each
// chunk finish. The AudioContext is created LAZILY on the first play() — so
// constructing the sink at module load touches no audio hardware.
const SAMPLE_RATE_HZ = 24_000;
const PCM16_FULL_SCALE = 32_768; // 2^15 — divisor mapping int16 → [-1, 1) float.

export function createAudioSink(opts?: { audioContextFactory?: () => AudioContext }): AudioSink {
  const audioContextFactory = opts?.audioContextFactory ?? (() => new AudioContext());

  let ctx: AudioContext | undefined;
  // Wall-clock (ctx.currentTime) instant at which the next chunk should start,
  // so consecutive chunks play back-to-back with no gap.
  let nextStart = 0;

  return {
    play(chunk: string): Promise<void> {
      ctx ??= audioContextFactory();
      const audioCtx = ctx;
      // Autoplay policies may leave a fresh context suspended — resume it so the
      // scheduled buffers actually sound.
      if (audioCtx.state === 'suspended') void audioCtx.resume();

      // base64 → bytes → little-endian Int16 samples → Float32 in [-1, 1).
      const binary = atob(chunk);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      // View the same bytes as little-endian 16-bit PCM (x86/ARM are LE; the
      // wire format is LE, so a direct Int16Array view is correct here).
      const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
      const float32 = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) float32[i] = (pcm[i] ?? 0) / PCM16_FULL_SCALE;

      const buffer = audioCtx.createBuffer(1, float32.length, SAMPLE_RATE_HZ);
      buffer.copyToChannel(float32, 0);

      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(audioCtx.destination);

      const startAt = Math.max(nextStart, audioCtx.currentTime);
      src.start(startAt);
      nextStart = startAt + buffer.duration;

      // Resolve when THIS chunk finishes so the narrator's drain sees it complete.
      return new Promise<void>((resolve) => {
        src.onended = () => resolve();
      });
    },
  };
}
