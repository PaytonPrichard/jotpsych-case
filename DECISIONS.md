# Decisions

- fal queue (submit + poll) instead of waiting on the video in one request: generation takes 1–2 min, so the API returns a requestId at once and the client polls.
- Video model fal-ai/veo3.1/lite at 9:16, 8s, 720p with audio: cheapest Veo tier that still speaks the script with lip sync.
- All model IDs, video settings and limits live in lib/config.ts: one place to tune cost and behaviour.
- fal client created with maxRetries 0: an automatic retry of a submit could bill for two videos.
- FAL_KEY and ANTHROPIC_API_KEY read only in server code (lib/fal.ts, route handlers), never NEXT_PUBLIC_: keys must not ship to the browser.
- Daily limit of 5 per visitor via an httpOnly date:count cookie: cheap guardrail without a database; bypassable by clearing cookies, acceptable for a demo.
- Limit counted only after a successful submit: failed attempts should not use up a visitor's quota.
- Status route calls result() once COMPLETED: a completed request can still have failed, and result() surfaces that error.
- Client polls with chained setTimeout (4s), not setInterval: never more than one status request in flight.
- Step 1 hardcodes the script and videoPrompt: proves the fal pipeline end to end on the live URL before adding Claude.
- Claude (claude-sonnet-5-5) returns { animal, script, videoPrompt } via structured outputs (zod schema): no hand-parsing JSON, a bad shape fails loudly.
- Claude effort "low": the visitor is waiting on this call, and a 15-word script doesn't need deep reasoning.
- Script prompt asks for 10 to 14 words: asking for "under 20" produced exactly 20; the lower target lands at 15-16 in testing.
- Feature text wrapped in <feature> tags and declared as data, not instructions: limits prompt injection from the textarea.
- Server appends the script and the brand/no-captions line to videoPrompt if Claude dropped them: subtitles and brand colors depend on both.
- stop_reason "refusal" maps to a friendly 422 message; no server-side fallback model: the plan names one model and a refusal should be visible, not silently rerouted.
- Anthropic client maxRetries 0: matches the no-automatic-retries rule; the visitor gets an error and a Try again button instead.
- Video model is a VideoModel union in lib/config.ts (veo3.1/lite or veo3.1/fast): both take identical input, so switching is one line.
- Player width capped at (100svh - 2rem) * 9/16 and object-contain: the whole vertical video fits a phone screen with native controls visible.
- Subtitles come from fal-ai/whisper (chunk_level "word", language "en") run on the finished video URL: Veo doesn't always say the script verbatim (test run: "listened" for "listen", "Who" for "Hoo"), so script-timed cues would drift from the audio.
- Whisper runs inside the status call that first sees COMPLETED: one round trip, the server only transcribes URLs fal itself returned (no client-supplied URLs), and the client stops polling after that.
- Whisper failure or 30s timeout returns words: null and the client falls back to script cues (2 or 3, spread over 0.5s-7.5s): a video with approximate subtitles beats an error.
- Cues: split at sentence ends, then cut each sentence evenly into 3-5 word cues; each cue holds until the next starts: greedy grouping left a 6-word cue spanning two sentences on real output.
- WebVTT built in the browser as a Blob URL on a <track default>: no storage needed, and a real <track> works in iOS fullscreen where script-added cues are less reliable.
- ::cue styled with exact #FFF2F5 text on #1E125E; frame is a #FD96C9 to #813FE8 gradient border; page #1C1E85: exact brand hex values, no approximations.

## Weak spots

- Daily limit is a cookie: clearing cookies or a private window resets it. First thing to check if fal spend spikes; the fix is an IP-keyed counter in a KV store (e.g. Upstash Redis).
- fal/Veo content refusals surface as a generic "couldn't be generated" message: check the "fal status failed" log line for the real fal error body.
- Script length is enforced only by the prompt (10-14 words asked, 15-16 typical). Check the "script too long for 8s" warning in logs; a long script gets cut off at 8s and the last cue never plays.
- Whisper can mishear brand words ("JotPsych"). If subtitles show the wrong spelling, pass the script as whisper's prompt or snap near-matches back to script words.
- Switching videoModel in lib/config.ts while a video is in flight makes its status call query the other endpoint. Redeploy only when no one is mid-generation, or return the model with requestId.
- The status route trusts any fal request id: anyone who guesses an id can see that video. Ids are random UUIDs, so low risk.
- autoPlay with sound is blocked on most phones: the video waits for a tap on the visible play control. Expected, not a bug.
- If generation takes over ~5 minutes the client keeps polling indefinitely; check fal queue status if a visitor reports an endless spinner.
