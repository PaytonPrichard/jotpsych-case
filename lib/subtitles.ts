// Pure helpers, safe on server and client: words or script -> cues -> WebVTT text.
import { config } from "./config";

export type Word = { text: string; start: number; end: number };
export type Cue = { start: number; end: number; text: string };

const MIN_WORDS = 3;
const MAX_WORDS = 5;

// Group word timestamps into cues of 3 to 5 words. Cues never span two sentences,
// and each sentence is cut into evenly sized cues so no cue is left with 1 or 2 words.
export function cuesFromWords(words: Word[]): Cue[] {
  const sentences: Word[][] = [];
  let current: Word[] = [];
  for (const word of words) {
    current.push(word);
    if (/[.!?]$/.test(word.text)) {
      sentences.push(current);
      current = [];
    }
  }
  if (current.length) sentences.push(current);

  // A sentence under 3 words ("Hoot!") joins its neighbour.
  for (let i = 0; i < sentences.length && sentences.length > 1; i++) {
    if (sentences[i].length < MIN_WORDS) {
      const target = i > 0 ? i - 1 : i + 1;
      sentences[target] = target < i ? [...sentences[target], ...sentences[i]] : [...sentences[i], ...sentences[target]];
      sentences.splice(i, 1);
      i--;
    }
  }

  const groups: Word[][] = [];
  for (const sentence of sentences) {
    const count = Math.ceil(sentence.length / MAX_WORDS);
    let taken = 0;
    for (let c = 0; c < count; c++) {
      const size = Math.round((sentence.length - taken) / (count - c));
      groups.push(sentence.slice(taken, taken + size));
      taken += size;
    }
  }

  return groups.map((group, i) => {
    const next = groups[i + 1];
    const start = group[0].start;
    // Hold each cue until the next one starts, so subtitles don't flicker between words.
    const end = next ? next[0].start : Math.max(group.at(-1)!.end, start + 1);
    return { start, end, text: group.map((w) => w.text).join(" ") };
  });
}

// Fallback when transcription fails: 2 or 3 cues spread evenly across 0.5s to 7.5s.
export function cuesFromScript(script: string): Cue[] {
  const words = script.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const count = Math.min(words.length, words.length > 10 ? 3 : 2);
  const start = 0.5;
  const span = config.videoSeconds - 1;
  const perCue = Math.ceil(words.length / count);

  const cues: Cue[] = [];
  for (let i = 0; i < words.length; i += perCue) {
    const chunk = words.slice(i, i + perCue);
    cues.push({
      start: start + (span * i) / words.length,
      end: start + (span * (i + chunk.length)) / words.length,
      text: chunk.join(" "),
    });
  }
  return cues;
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
