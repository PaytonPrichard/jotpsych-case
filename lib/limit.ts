import { cookies } from "next/headers";
import { config } from "./config";

// Cookie value: "YYYY-MM-DD:count". Resets when the UTC date changes.
function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function usedToday(): Promise<number> {
  const raw = (await cookies()).get(config.limitCookie)?.value ?? "";
  const [date, count] = raw.split(":");
  return date === today() ? Number(count) || 0 : 0;
}

export async function recordUse(used: number) {
  (await cookies()).set(config.limitCookie, `${today()}:${used + 1}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
  });
}
