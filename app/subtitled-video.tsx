"use client";

import { useEffect, useRef, useState } from "react";

// The WebVTT track stays as the source of truth but is "hidden": native cue rendering
// jumps when the controls show and iOS ignores ::cue, so we draw the active cue ourselves.
export function SubtitledVideo({ videoUrl, vttUrl }: { videoUrl: string; vttUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    const trackEl = trackRef.current;
    if (!video || !trackEl) return;
    const track = trackEl.track;
    // Hidden still loads cues and fires cuechange, but the browser draws nothing.
    track.mode = "hidden";

    const update = () => {
      const t = video.currentTime;
      const cue = Array.from(track.cues ?? []).find((c) => c.startTime <= t && t < c.endTime);
      setText(cue ? (cue as VTTCue).text : "");
    };

    const videoEvents = ["timeupdate", "seeked", "loadedmetadata"] as const;
    videoEvents.forEach((e) => video.addEventListener(e, update));
    track.addEventListener("cuechange", update);
    trackEl.addEventListener("load", update);
    return () => {
      videoEvents.forEach((e) => video.removeEventListener(e, update));
      track.removeEventListener("cuechange", update);
      trackEl.removeEventListener("load", update);
    };
  }, [vttUrl]);

  return (
    <div className="relative h-full w-full" style={{ containerType: "inline-size" }}>
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        autoPlay
        playsInline
        className="h-full w-full object-contain"
      >
        <track ref={trackRef} kind="subtitles" src={vttUrl} srcLang="en" label="English" />
      </video>
      {text && (
        // Fixed spot in the lower third, clear of the native control bar; taps pass through to the video.
        <div className="pointer-events-none absolute inset-x-0 bottom-[22%] flex justify-center px-[6%]">
          <p
            className="line-clamp-2 rounded-lg px-3 py-1.5 text-center font-bold leading-snug text-[#FFF2F5]"
            // #1E125E at 85% opacity, written as exact RGB.
            style={{ fontSize: "max(15px, 6cqw)", backgroundColor: "rgb(30 18 94 / 0.85)" }}
          >
            {text}
          </p>
        </div>
      )}
    </div>
  );
}
