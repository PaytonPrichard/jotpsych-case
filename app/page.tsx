"use client";

import { useEffect, useRef, useState } from "react";
import { config } from "@/lib/config";

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "waiting"; requestId: string; script: string; queueStatus: string }
  | { kind: "done"; script: string; videoUrl: string }
  | { kind: "error"; message: string };

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
          setPhase({ kind: "done", script: scriptRef.current, videoUrl: data.videoUrl });
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

  const busy = phase.kind === "submitting" || phase.kind === "waiting";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        maxLength={config.maxInputChars}
        rows={4}
        placeholder="Describe a JotPsych feature…"
        disabled={busy}
        className="w-full resize-none rounded-lg border-2 border-[#813FE8] bg-[#1E125E] p-3 text-[#FFF2F5] placeholder:text-[#FFF2F5]/50 focus:border-[#FD96C9] focus:outline-none"
      />
      <button
        onClick={generate}
        disabled={busy || !input.trim()}
        className="rounded-lg bg-[#FD96C9] py-3 font-semibold text-[#1C1E85] disabled:opacity-50"
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

      {/* Width capped so the whole 9:16 frame fits in the phone's visible height. */}
      <div className="mx-auto w-full max-w-[calc((100svh-2rem)*9/16)] rounded-2xl bg-gradient-to-br from-[#FD96C9] to-[#813FE8] p-1.5">
        <div className="aspect-[9/16] w-full overflow-hidden rounded-xl bg-[#1E125E]">
          {phase.kind === "done" && (
            <video src={phase.videoUrl} controls autoPlay playsInline className="h-full w-full object-contain" />
          )}
        </div>
      </div>
    </main>
  );
}
