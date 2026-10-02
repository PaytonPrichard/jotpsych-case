// Single place for model IDs, video settings and guardrail limits.

// Both Veo tiers take the same input. Lite is the default; VIDEO_MODEL can switch to Fast.
const VIDEO_MODELS = ["fal-ai/veo3.1/lite", "fal-ai/veo3.1/fast"] as const;
export type VideoModel = (typeof VIDEO_MODELS)[number];

export const config = {
  claudeModel: "claude-sonnet-5-5",
  defaultVideoModel: "fal-ai/veo3.1/lite" as VideoModel,
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

// Server-only, read per request like MOCK: set VIDEO_MODEL in .env.local to compare Fast locally.
// Never set on Vercel. Anything other than the two allowed IDs falls back to the default.
export function videoModel(): VideoModel {
  const fromEnv = process.env.VIDEO_MODEL;
  if (!fromEnv) return config.defaultVideoModel;
  if ((VIDEO_MODELS as readonly string[]).includes(fromEnv)) return fromEnv as VideoModel;
  console.warn("ignoring invalid VIDEO_MODEL", { fromEnv });
  return config.defaultVideoModel;
}
