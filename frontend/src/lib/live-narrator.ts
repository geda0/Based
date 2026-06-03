export type RelaySocket = {
  on(event: string, cb: (...args: unknown[]) => void): void;
  send(data: unknown): void;
  close?(): void;
  setup?: unknown;
};

export type AudioSink = {
  play(chunk: string): Promise<void>;
};

export type VoiceNarrator = {
  speak(text: string): Promise<void>;
  stop?(): void;
};

type ServerContentMessage = {
  serverContent?: {
    turnComplete?: boolean;
    modelTurn?: {
      parts?: Array<{
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
  };
};

export function createLiveNarrator(deps: {
  openRelay: () => RelaySocket;
  audio?: AudioSink;
}): VoiceNarrator {
  return {
    speak(text: string): Promise<void> {
      const ws = deps.openRelay();
      return new Promise<void>((resolve, reject) => {
        const plays: Promise<void>[] = [];
        let turnComplete = false;

        function tryResolve(): void {
          if (turnComplete) {
            void Promise.all(plays).then(() => { ws.close?.(); resolve(); });
          }
        }

        ws.on("open", () => {
          ws.send(JSON.stringify(ws.setup));
          ws.send(
            JSON.stringify({
              clientContent: {
                turns: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: `Speak only these exact words. Do not add anything. Say: "${text}"`,
                      },
                    ],
                  },
                ],
                turnComplete: true,
              },
            }),
          );
        });
        ws.on("error", (err: unknown) => {
          reject(err instanceof Error ? err : new Error(String(err)));
        });
        ws.on("message", (raw: unknown) => {
          try {
            // Cross-realm-safe binary-frame decode: `instanceof ArrayBuffer` fails
            // across VM contexts (e.g. jsdom/vitest sandbox); toString is reliable.
            const text =
              typeof raw === "string" ? raw
              : Object.prototype.toString.call(raw) === "[object ArrayBuffer]"
                ? new TextDecoder().decode(raw as ArrayBuffer)
              : ArrayBuffer.isView(raw) ? new TextDecoder().decode(raw.buffer as ArrayBuffer) // typed-array views, defensive
              : undefined;
            if (text === undefined) return; // unknown frame type — ignore, don't throw
            const msg = JSON.parse(text) as ServerContentMessage;
            const parts = msg?.serverContent?.modelTurn?.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                const data = part?.inlineData?.data;
                if (typeof data === "string") {
                  plays.push(deps.audio?.play(data) ?? Promise.resolve());
                }
              }
            }
            if (msg?.serverContent?.turnComplete === true) {
              turnComplete = true;
              tryResolve();
            }
          } catch {
            // non-JSON or unexpected shape — ignore
          }
        });
      });
    },
  };
}
