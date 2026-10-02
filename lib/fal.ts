// Server-only: FAL_KEY must never reach the browser.
import { createFalClient } from "@fal-ai/client";

export const fal = createFalClient({
  credentials: process.env.FAL_KEY,
  // No automatic retries: a retried submit could bill twice.
  retry: { maxRetries: 0 },
});
