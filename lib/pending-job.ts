// Client-only: remembers the in-flight video job so a refresh can resume polling.
// localStorage can be missing or throw (private mode, blocked storage), so every access is guarded
// and failure just means no resume.

const KEY = "pendingJob";
export const RESUME_WINDOW_MS = 10 * 60 * 1000;

export type PendingJob = { requestId: string; script: string; startedAt: number };

export function saveJob(requestId: string, script: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ requestId, script, startedAt: Date.now() }));
  } catch {}
}

export function clearJob() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

// Returns the saved job if it is well formed and under 10 minutes old; otherwise clears it.
export function loadJob(): PendingJob | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const job = JSON.parse(raw) as Partial<PendingJob>;
    const fresh = typeof job.startedAt === "number" && Date.now() - job.startedAt < RESUME_WINDOW_MS;
    if (typeof job.requestId === "string" && typeof job.script === "string" && fresh) {
      return job as PendingJob;
    }
  } catch {}
  clearJob();
  return null;
}
