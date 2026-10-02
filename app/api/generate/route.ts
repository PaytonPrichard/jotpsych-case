import { config } from "@/lib/config";
import { fal } from "@/lib/fal";
import { recordUse, usedToday } from "@/lib/limit";

// Step 1: hardcoded script and prompt. Claude replaces this in step 2.
const SCRIPT =
  "Hi, I'm Otto! JotPsych writes your session notes, so you can focus on patients, not paperwork.";
const VIDEO_PROMPT = `Vertical cartoon scene of a cheerful otter speaking directly to camera, saying: "${SCRIPT}" Friendly, light, comedic delivery. Background and props in deep navy #1C1E85, purple #813FE8 and pink #FD96C9. No on-screen text, no captions.`;

export async function POST(request: Request) {
  let body: { input?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) {
    return Response.json({ error: "Please describe a feature first." }, { status: 400 });
  }
  if (input.length > config.maxInputChars) {
    return Response.json(
      { error: `Please keep it under ${config.maxInputChars} characters.` },
      { status: 400 },
    );
  }

  const used = await usedToday();
  if (used >= config.dailyLimit) {
    return Response.json(
      { error: `You've reached the limit of ${config.dailyLimit} videos today. Come back tomorrow!` },
      { status: 429 },
    );
  }

  try {
    const { request_id } = await fal.queue.submit(config.videoModel, {
      input: { prompt: VIDEO_PROMPT, ...config.video },
    });
    await recordUse(used);
    return Response.json({ requestId: request_id, script: SCRIPT });
  } catch (err) {
    console.error("fal submit failed", err);
    return Response.json({ error: "Couldn't start the video. Please try again." }, { status: 502 });
  }
}
