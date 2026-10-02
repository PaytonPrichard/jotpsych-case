"use client";

import { useEffect, useRef, useState } from "react";
import { config } from "@/lib/config";
import { cuesFromScript, cuesFromWords, toVtt, type Word } from "@/lib/subtitles";
import { SubtitledVideo } from "./subtitled-video";

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "waiting"; requestId: string; script: string; queueStatus: string }
  | { kind: "done"; videoUrl: string; vttUrl: string }
  | { kind: "error"; message: string };

// Prefer real word timings from transcription; fall back to evenly spread script cues.
function buildVttUrl(words: Word[] | null, script: string) {
  const cues = words?.length ? cuesFromWords(words) : cuesFromScript(script);
  return URL.createObjectURL(new Blob([toVtt(cues)], { type: "text/vtt" }));
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export default function Home() {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const scriptRef = useRef("");
  const requestId = phase.kind === "waiting" ? phase.requestId : null;

  async function generate() {
    setPhase({ kind: "submitting" });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      scriptRef.current = data.script;
      setPhase({ kind: "waiting", requestId: data.requestId, script: data.script, queueStatus: "IN_QUEUE" });
    } catch (err) {
      setPhase({ kind: "error", message: errorMessage(err) });
    }
  }

  // Poll status while waiting, one request in flight at a time.
  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/status?id=${encodeURIComponent(requestId!)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || data.status === "FAILED") throw new Error(data.error ?? "Something went wrong.");
        if (data.status === "COMPLETED") {
          setPhase({ kind: "done", videoUrl: data.videoUrl, vttUrl: buildVttUrl(data.words, scriptRef.current) });
          return;
        }
        setPhase((p) => (p.kind === "waiting" ? { ...p, queueStatus: data.status } : p));
        timer = setTimeout(poll, config.pollIntervalMs);
      } catch (err) {
        if (!cancelled) setPhase({ kind: "error", message: errorMessage(err) });
      }
    }

    timer = setTimeout(poll, config.pollIntervalMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [requestId]);

  // Free the subtitle blob when it's replaced.
  const vttUrl = phase.kind === "done" ? phase.vttUrl : null;
  useEffect(() => {
    if (!vttUrl) return;
    return () => URL.revokeObjectURL(vttUrl);
  }, [vttUrl]);

  const busy = phase.kind === "submitting" || phase.kind === "waiting";

  return (
    // One screen, no scrolling: the controls take their natural height, the player gets the rest.
    <main className="mx-auto flex h-svh w-full max-w-md flex-col gap-3 px-4 py-4">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        maxLength={config.maxInputChars}
        rows={3}
        placeholder="Describe a JotPsych feature…"
        disabled={busy}
        className="w-full shrink-0 resize-none rounded-lg border-2 border-[#813FE8] bg-[#1E125E] px-3 py-2 text-base leading-5 text-[#FFF2F5] placeholder:text-[#FFF2F5]/50 focus:border-[#FD96C9] focus:outline-none"
      />
      <button
        onClick={generate}
        disabled={busy || !input.trim()}
        className="shrink-0 rounded-lg bg-[#FD96C9] py-2 font-semibold text-[#1C1E85] disabled:opacity-50"
      >
        Go
      </button>

      {phase.kind === "submitting" && <p className="text-sm">Writing the script…</p>}
      {phase.kind === "waiting" && (
        <div className="text-sm">
          <p className="italic">“{phase.script}”</p>
          <p className="mt-1 opacity-75">
            {phase.queueStatus === "IN_QUEUE" ? "Queued" : "Generating video"}, takes about 1 to 2 minutes…
          </p>
        </div>
      )}
      {phase.kind === "error" && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p>{phase.message}</p>
          <button
            onClick={() => setPhase({ kind: "idle" })}
            className="shrink-0 rounded-md border border-[#FD96C9] px-3 py-1"
          >
            Try again
          </button>
        </div>
      )}

      {/* Size container: the frame is the largest 9:16 box that fits the remaining width and height. */}
      <div className="flex min-h-0 flex-1 items-start justify-center" style={{ containerType: "size" }}>
        <div
          className="rounded-2xl bg-gradient-to-br from-[#FD96C9] to-[#813FE8] p-1.5"
          style={{ width: "min(100cqw, 100cqh * 9 / 16)", aspectRatio: "9 / 16" }}
        >
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-[#1E125E]">
            {phase.kind === "done" ? (
              <SubtitledVideo videoUrl={phase.videoUrl} vttUrl={phase.vttUrl} />
            ) : (
              <p className="px-4 text-center text-sm opacity-60">Your video will play here.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
