// Single place for model IDs, video settings and guardrail limits.

// Switch to "fal-ai/veo3.1/fast" to compare quality; both take the same input.
export type VideoModel = "fal-ai/veo3.1/lite" | "fal-ai/veo3.1/fast";

export const config = {
  claudeModel: "claude-sonnet-5-5",
  videoModel: "fal-ai/veo3.1/lite" as VideoModel,
  transcribeModel: "fal-ai/whisper",
  video: {
    aspect_ratio: "9:16",
    duration: "8s",
    resolution: "720p",
    generate_audio: true,
  },
  videoSeconds: 8,
  maxScriptWords: 20,
  maxInputChars: 500,
  dailyLimit: 10,
  pollIntervalMs: 4000,
  limitCookie: "gen_count",
} as const;
