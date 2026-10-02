// Pure helpers, safe on server and client: words or script -> cues -> WebVTT text.
import { config } from "./config";

export type Word = { text: string; start: number; end: number };
export type Cue = { start: number; end: number; text: string };

const MAX_WORDS = 6;
// Share of words that must match before the script's spelling replaces Whisper's.
const ALIGN_MIN_MATCH = 0.8;

const normalize = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, "");

// Whisper splits some words into tokens that start with a hyphen or apostrophe
// ("wake" + "-up", "it" + "'s", "do" + "n't"); those attach to the previous word with no space.
const ATTACHED = /^[-'’]|^n't$/i;

export function joinTokens(texts: string[]): string {
  return texts.reduce((out, t, i) => (i === 0 ? t : ATTACHED.test(t) ? out + t : `${out} ${t}`), "");
}

// Glue attached tokens onto the previous word, keeping the first start and last end time,
// so word counts match the script and a cue can't break inside "wake-up".
export function mergeAttached(words: Word[]): Word[] {
  const merged: Word[] = [];
  for (const w of words) {
    const prev = merged.at(-1);
    if (prev && ATTACHED.test(w.text)) {
      merged[merged.length - 1] = { ...prev, text: prev.text + w.text, end: w.end };
    } else {
      merged.push(w);
    }
  }
  return merged;
}

// Keep Whisper's timings but use the script's spelling ("Dam right", not "Damn right") when
// the transcript matches the script word for word: same word count and at least 80% identical.
// If they diverge, keep Whisper's text: it reflects what was actually said.
export function alignToScript(tokens: Word[], script: string): Word[] {
  const words = mergeAttached(tokens);
  const scriptWords = script.trim().split(/\s+/).filter(Boolean);
  if (!scriptWords.length || scriptWords.length !== words.length) return words;
  const matches = words.filter((w, i) => normalize(w.text) === normalize(scriptWords[i])).length;
  if (matches / words.length < ALIGN_MIN_MATCH) return words;
  return words.map((w, i) => ({ ...w, text: scriptWords[i] }));
}
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
  const groups = toCueGroups(mergeAttached(words), (w) => w.text);
  const lead = (t: number) => Math.max(0, t - CUE_LEAD_SECONDS);
  return groups.map((group, i) => {
    const next = groups[i + 1];
    const start = lead(group[0].start);
    const end = next ? lead(next[0].start) : Math.max(group.at(-1)!.end, start + 1);
    return { start, end, text: joinTokens(group.map((w) => w.text)) };
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
