import type { NextRequest } from "next/server";
import { config, videoModel } from "@/lib/config";
import { fal } from "@/lib/fal";
import { MOCK_PREFIX, MOCK_VIDEO_URL, mockEnabled, mockReady } from "@/lib/mock";
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
    videoUrl = MOCK_VIDEO_URL;
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
  const words = await transcribe(videoUrl);

  // One line per finished video so every video is findable in Vercel logs. The script comes
  // back from the client (only generate knows it), so it is capped and logged as data.
  const script = (request.nextUrl.searchParams.get("script") ?? "").slice(0, config.maxInputChars);
  console.log(
    "video completed",
    JSON.stringify({
      requestId: id,
      model: mock ? "mock" : model,
      videoUrl,
      script,
      heard: words?.map((w) => w.text).join(" ") ?? null,
    }),
  );

  return Response.json({ status: "COMPLETED", videoUrl, words });
}
