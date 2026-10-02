// Pure helpers, safe on server and client: words or script -> cues -> WebVTT text.
import { config } from "./config";

export type Word = { text: string; start: number; end: number };
export type Cue = { start: number; end: number; text: string };

const MAX_WORDS = 6;
// Captions should lead the voice, not trail it.
export const CUE_LEAD_SECONDS = 0.15;

// Split at every . ! ? (a cue never spans two sentences, however short), then cut any
// sentence over 6 words into evenly sized pieces. Our scripts are usually one cue per sentence.
function toCueGroups<T>(items: T[], text: (item: T) => string): T[][] {
  const sentences: T[][] = [];
  let current: T[] = [];
  for (const item of items) {
    current.push(item);
    if (/[.!?]["')\]]*$/.test(text(item))) {
      sentences.push(current);
      current = [];
    }
  }
  if (current.length) sentences.push(current);

  const groups: T[][] = [];
  for (const sentence of sentences) {
    const count = Math.ceil(sentence.length / MAX_WORDS);
    let taken = 0;
    for (let c = 0; c < count; c++) {
      const size = Math.round((sentence.length - taken) / (count - c));
      groups.push(sentence.slice(taken, taken + size));
      taken += size;
    }
  }
  return groups;
}

// Cues from Whisper word timings. Each cue starts 0.15s before its first word and holds
// until the next cue takes over, so subtitles don't flicker off between words.
export function cuesFromWords(words: Word[]): Cue[] {
  const groups = toCueGroups(words, (w) => w.text);
  const lead = (t: number) => Math.max(0, t - CUE_LEAD_SECONDS);
  return groups.map((group, i) => {
    const next = groups[i + 1];
    const start = lead(group[0].start);
    const end = next ? lead(next[0].start) : Math.max(group.at(-1)!.end, start + 1);
    return { start, end, text: group.map((w) => w.text).join(" ") };
  });
}

// Fallback when transcription fails: the same sentence cues, with time spread across
// 0.5s to 7.5s in proportion to each cue's word count.
export function cuesFromScript(script: string): Cue[] {
  const words = script.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const groups = toCueGroups(words, (w) => w);
  const start = 0.5;
  const span = config.videoSeconds - 1;

  let done = 0;
  return groups.map((group) => {
    const cue = {
      start: start + (span * done) / words.length,
      end: start + (span * (done + group.length)) / words.length,
      text: group.join(" "),
    };
    done += group.length;
    return cue;
  });
}

function timestamp(seconds: number) {
  const ms = Math.round(Math.max(0, seconds) * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

function escape(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function toVtt(cues: Cue[]): string {
  const body = cues
    .map((c, i) => `${i + 1}\n${timestamp(c.start)} --> ${timestamp(c.end)}\n${escape(c.text)}`)
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}
