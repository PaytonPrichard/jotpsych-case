// Single place for model IDs, video settings and guardrail limits.
export const config = {
  claudeModel: "claude-sonnet-5-5",
  videoModel: "fal-ai/veo3.1/lite",
  video: {
    aspect_ratio: "9:16",
    duration: "8s",
    resolution: "720p",
    generate_audio: true,
  },
  maxInputChars: 500,
  dailyLimit: 5,
  pollIntervalMs: 4000,
  limitCookie: "gen_count",
} as const;
