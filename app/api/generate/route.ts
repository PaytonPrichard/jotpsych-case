import { config, videoModel } from "@/lib/config";
import { fal } from "@/lib/fal";
import { recordUse, usedToday } from "@/lib/limit";
import { MOCK_SCRIPT, mockEnabled, mockRequestId } from "@/lib/mock";
import { ScriptRefusal, writeScript, type Script } from "@/lib/script";

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

  // Mock mode is free, so it bypasses the daily limit and never counts against it.
  if (mockEnabled()) {
    return Response.json({ requestId: mockRequestId(), script: MOCK_SCRIPT });
  }

  const used = await usedToday();
  if (used >= config.dailyLimit) {
    return Response.json(
      { error: `You've reached the limit of ${config.dailyLimit} videos today. Come back tomorrow!` },
      { status: 429 },
    );
  }

  let script: Script;
  try {
    script = await writeScript(input);
  } catch (err) {
    if (err instanceof ScriptRefusal) {
      return Response.json(
        { error: "Our animals couldn't make a video about that. Try describing a JotPsych feature." },
        { status: 422 },
      );
    }
    console.error("script failed", err);
    return Response.json({ error: "Couldn't write the script. Please try again." }, { status: 502 });
  }

  try {
    const model = videoModel();
    const { request_id } = await fal.queue.submit(model, {
      input: { prompt: script.videoPrompt, ...config.video },
    });
    await recordUse(used);
    console.log("submitted", { requestId: request_id, model, ...script });
    return Response.json({ requestId: request_id, script: script.script });
  } catch (err) {
    console.error("fal submit failed", err);
    return Response.json({ error: "Couldn't start the video. Please try again." }, { status: 502 });
  }
}
