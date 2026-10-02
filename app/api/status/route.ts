import type { NextRequest } from "next/server";
import { config, videoModel } from "@/lib/config";
import { fal } from "@/lib/fal";
import { MOCK_PREFIX, mockEnabled, mockReady, mockVideoUrl } from "@/lib/mock";
import { alignToScript } from "@/lib/subtitles";
import { transcribe } from "@/lib/transcribe";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[\w-]{8,64}$/.test(id)) {
    return Response.json({ error: "Missing or invalid id." }, { status: 400 });
  }

  const mock = mockEnabled() && id.startsWith(MOCK_PREFIX);
  const model = videoModel();
  let videoUrl: string;
  if (mock && id.startsWith(MOCK_PREFIX)) {
    // Mock: fixed video after 5s, but real transcription so subtitles are tested end to end.
    if (!mockReady(id)) return Response.json({ status: "IN_PROGRESS" });
    videoUrl = mockVideoUrl();
  } else {
    try {
      const status = await fal.queue.status(model, { requestId: id });
      if (status.status !== "COMPLETED") {
        return Response.json({ status: status.status });
      }
      // A COMPLETED request can still have failed; result() throws in that case.
      const result = await fal.queue.result(model, { requestId: id });
      const url = result.data?.video?.url;
      if (!url) throw new Error("No video URL in result");
      videoUrl = url;
    } catch (err) {
      console.error("fal status failed", err);
      return Response.json(
        {
          status: "FAILED",
          error: "The video couldn't be generated. The video model may have declined it; try rewording.",
        },
        { status: 502 },
      );
    }
  }

  // The client stops polling after COMPLETED, so this runs once per video.
  // The script comes back from the client (only generate knows it), so it is capped and
  // treated as data: a spelling reference for the subtitles and a field in the log.
  const script = (request.nextUrl.searchParams.get("script") ?? "").slice(0, config.maxInputChars);
  const heard = await transcribe(videoUrl);
  const words = heard && alignToScript(heard, script);

  // One line per finished video so every video is findable in Vercel logs.
  console.log(
    "video completed",
    JSON.stringify({
      requestId: id,
      model: mock ? "mock" : model,
      videoUrl,
      script,
      heard: heard?.map((w) => w.text).join(" ") ?? null,
    }),
  );
  // Word timings for debugging subtitle sync, e.g. "first@5.12-5.40".
  console.log(
    "whisper words",
    JSON.stringify({
      requestId: id,
      words: heard?.map((w) => `${w.text}@${w.start.toFixed(2)}-${w.end.toFixed(2)}`) ?? null,
    }),
  );

  return Response.json({ status: "COMPLETED", videoUrl, words });
}
