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
