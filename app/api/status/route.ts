import type { NextRequest } from "next/server";
import { config } from "@/lib/config";
import { fal } from "@/lib/fal";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[\w-]{8,64}$/.test(id)) {
    return Response.json({ error: "Missing or invalid id." }, { status: 400 });
  }

  try {
    const status = await fal.queue.status(config.videoModel, { requestId: id });
    if (status.status !== "COMPLETED") {
      return Response.json({ status: status.status });
    }
    // A COMPLETED request can still have failed; result() throws in that case.
    const result = await fal.queue.result(config.videoModel, { requestId: id });
    const url = result.data?.video?.url;
    if (!url) throw new Error("No video URL in result");
    return Response.json({ status: "COMPLETED", videoUrl: url });
  } catch (err) {
    console.error("fal status failed", err);
    return Response.json(
      { status: "FAILED", error: "The video couldn't be generated. Please try again." },
      { status: 502 },
    );
  }
}
