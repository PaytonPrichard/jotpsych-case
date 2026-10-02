"use client";

import { useEffect, useRef, useState } from "react";

// The WebVTT track stays as the source of truth but is "hidden": native cue rendering
// jumps when the controls show and iOS ignores ::cue, so we draw the active cue ourselves.
// Fullscreen shows only the <video>, so there the track switches to "showing" and the browser
// draws the captions natively. One switch drives both: native captions and our overlay are
// never on at the same time.
export function SubtitledVideo({
  videoUrl,
  vttUrl,
  onPlay,
}: {
  videoUrl: string;
  vttUrl: string;
  onPlay?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);
  const [text, setText] = useState("");
  const [nativeCaptions, setNativeCaptions] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const trackEl = trackRef.current;
    if (!video || !trackEl) return;
    const track = trackEl.track;
    // Hidden still loads the cues, but the browser draws nothing.
    track.mode = "hidden";

    // React skips the re-render when the text is unchanged, so calling this every frame is cheap.
    const update = () => {
      const t = video.currentTime;
      const cue = Array.from(track.cues ?? []).find((c) => c.startTime <= t && t < c.endTime);
      setText(cue ? (cue as VTTCue).text : "");
    };

    // While playing, check every animation frame: timeupdate fires only ~4 times a second,
    // which made cues switch up to 250ms late.
    let frame = 0;
    const tick = () => {
      update();
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      update();
    };

    // Desktop: the Fullscreen API (webkit-prefixed on older Safari) fires on the document.
    // iPhone: native fullscreen fires webkitbeginfullscreen / webkitendfullscreen on the video.
    const setFullscreen = (on: boolean) => {
      track.mode = on ? "showing" : "hidden";
      setNativeCaptions(on);
    };
    const onFullscreenChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setFullscreen((doc.fullscreenElement ?? doc.webkitFullscreenElement) === video);
    };
    const onBegin = () => setFullscreen(true);
    const onEnd = () => setFullscreen(false);
    const docEvents = ["fullscreenchange", "webkitfullscreenchange"] as const;
    docEvents.forEach((e) => document.addEventListener(e, onFullscreenChange));
    video.addEventListener("webkitbeginfullscreen", onBegin);
    video.addEventListener("webkitendfullscreen", onEnd);

    const onceEvents = ["seeked", "loadedmetadata"] as const;
    const stopEvents = ["pause", "ended"] as const;
    video.addEventListener("play", start);
    onceEvents.forEach((e) => video.addEventListener(e, update));
    stopEvents.forEach((e) => video.addEventListener(e, stop));
    trackEl.addEventListener("load", update);
    if (!video.paused) start();
    return () => {
      cancelAnimationFrame(frame);
      video.removeEventListener("play", start);
      onceEvents.forEach((e) => video.removeEventListener(e, update));
      stopEvents.forEach((e) => video.removeEventListener(e, stop));
      trackEl.removeEventListener("load", update);
      docEvents.forEach((e) => document.removeEventListener(e, onFullscreenChange));
      video.removeEventListener("webkitbeginfullscreen", onBegin);
      video.removeEventListener("webkitendfullscreen", onEnd);
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
        onPlay={onPlay}
        className="h-full w-full object-contain"
      >
        <track ref={trackRef} kind="subtitles" src={vttUrl} srcLang="en" label="English" />
      </video>
      {text && !nativeCaptions && (
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
