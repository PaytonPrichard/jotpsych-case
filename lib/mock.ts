// Fixed sample used when config.mock is true: a real veo3.1/lite output and its Whisper words.
import type { Word } from "./subtitles";

export const MOCK_PREFIX = "mock-";
export const MOCK_DELAY_MS = 5000;

export const MOCK_SCRIPT =
  "I listen to your whole session, so your progress note writes itself. Hoo needs homework tonight?";

// fal media URLs are cached for 60 days; replace with a fresh output if this one 404s.
export const MOCK_VIDEO_URL =
  "https://v3b.fal.media/files/b/0aacc714/NrReAhZ7Qz4UoilBAHjFq_4b6fcdf7047d42aebc8e92255319d293.mp4";

export const MOCK_WORDS: Word[] = [
  { text: "I", start: 0.03, end: 0.37 },
  { text: "listened", start: 0.37, end: 0.71 },
  { text: "to", start: 0.71, end: 0.87 },
  { text: "your", start: 0.87, end: 1.03 },
  { text: "whole", start: 1.03, end: 1.27 },
  { text: "session,", start: 1.27, end: 1.81 },
  { text: "so", start: 1.81, end: 2.17 },
  { text: "your", start: 2.17, end: 2.37 },
  { text: "progress", start: 2.37, end: 2.77 },
  { text: "note", start: 2.77, end: 3.11 },
  { text: "writes", start: 3.11, end: 3.43 },
  { text: "itself.", start: 3.43, end: 4.27 },
  { text: "Who", start: 4.53, end: 4.75 },
  { text: "needs", start: 4.75, end: 5.91 },
  { text: "homework", start: 5.91, end: 6.43 },
  { text: "tonight?", start: 6.43, end: 7.15 },
];

// The fake requestId carries its creation time, so status needs no server state.
export function mockRequestId() {
  return `${MOCK_PREFIX}${Date.now()}`;
}

export function mockStatus(id: string) {
  const created = Number(id.slice(MOCK_PREFIX.length));
  if (!Number.isFinite(created) || Date.now() - created < MOCK_DELAY_MS) {
    return { status: "IN_PROGRESS" };
  }
  return { status: "COMPLETED", videoUrl: MOCK_VIDEO_URL, words: MOCK_WORDS };
}
