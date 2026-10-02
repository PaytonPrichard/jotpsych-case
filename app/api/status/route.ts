import type { NextRequest } from "next/server";
import { config } from "@/lib/config";
import { fal } from "@/lib/fal";
import { MOCK_PREFIX, mockStatus } from "@/lib/mock";
import { transcribe } from "@/lib/transcribe";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[\w-]{8,64}$/.test(id)) {
    return Response.json({ error: "Missing or invalid id." }, { status: 400 });
  }

  if (config.mock && id.startsWith(MOCK_PREFIX)) {
    return Response.json(mockStatus(id));
  }

  let videoUrl: string;
  try {
    const status = await fal.queue.status(config.videoModel, { requestId: id });
    if (status.status !== "COMPLETED") {
      return Response.json({ status: status.status });
    }
    // A COMPLETED request can still have failed; result() throws in that case.
    const result = await fal.queue.result(config.videoModel, { requestId: id });
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

  // The client stops polling after COMPLETED, so this runs once per video.
  const words = await transcribe(videoUrl);
  return Response.json({ status: "COMPLETED", videoUrl, words });
}
