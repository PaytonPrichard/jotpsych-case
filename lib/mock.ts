// Fixed sample used in mock mode. Claude and Veo are skipped; Whisper still runs.

// Mock mode comes only from the environment: set MOCK=1 in .env.local for local testing.
// It is never set on Vercel, so production can't serve mock videos. Read per request, not at build.
export function mockEnabled() {
  return process.env.MOCK === "1";
}

export const MOCK_PREFIX = "mock-";
export const MOCK_DELAY_MS = 5000;

export const MOCK_SCRIPT =
  "Mock mode! No real video was generated, so this test costs almost nothing.";

// fal media URLs expire after about 60 days; replace this if the mock player shows a broken video.
export const MOCK_VIDEO_URL =
  "https://v3b.fal.media/files/b/0aaca76f/0tio3NfiTvTRgTuOCmCfG_9b6dbd0e424f4ca7ae2bc91753f9253c.mp4";

// The fake requestId carries its creation time, so status needs no server state.
export function mockRequestId() {
  return `${MOCK_PREFIX}${Date.now()}`;
}

export function mockReady(id: string) {
  const created = Number(id.slice(MOCK_PREFIX.length));
  return Number.isFinite(created) && Date.now() - created >= MOCK_DELAY_MS;
}
