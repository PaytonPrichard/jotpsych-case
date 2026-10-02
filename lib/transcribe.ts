// Server-only: transcribe the finished video so subtitles match the spoken words.
import { config } from "./config";
import { fal } from "./fal";
import type { Word } from "./subtitles";

const TIMEOUT_MS = 30_000;

// Returns word timings, or null on any failure so the client falls back to script cues.
export async function transcribe(videoUrl: string): Promise<Word[] | null> {
  try {
    const run = fal.subscribe(config.transcribeModel, {
      input: { audio_url: videoUrl, chunk_level: "word", task: "transcribe", language: "en" },
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("whisper timed out")), TIMEOUT_MS),
    );
    const { data } = await Promise.race([run, timeout]);

    const words: Word[] = [];
    for (const chunk of data.chunks ?? []) {
      const [start, end] = chunk.timestamp as [number | null, number | null];
      const text = chunk.text.trim();
      if (!text || typeof start !== "number") continue;
      words.push({ text, start, end: typeof end === "number" ? end : start + 0.4 });
    }
    // A word timed past the end of the video means Whisper hallucinated; use script cues instead.
    if (words.some((w) => w.start > config.videoSeconds + 1)) {
      console.warn("transcript timed past video end, ignoring", { videoUrl });
      return null;
    }
    return words.length ? words : null;
  } catch (err) {
    console.error("transcription failed", err);
    return null;
  }
}
