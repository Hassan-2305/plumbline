import "server-only";

// Protects the AI routes. The keys never leave the server, but anyone who finds
// a deployed URL could still call these routes and spend the key's quota.
// 1. Browsers send Origin / Sec-Fetch-Site: requests from other sites are refused.
// 2. Every client IP gets a small budget of AI calls (AI_RATE_LIMIT per 10 minutes).
// The budget is per server instance, so it limits abuse rather than metering exactly.

const WINDOW_MS = 10 * 60_000;
const hits = new Map<string, number[]>();

function deny(status: number, code: "bad_request" | "rate_limited", message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

/** Returns a response to send instead of handling the request, or null when it may proceed. */
export function guardAiRequest(request: Request): Response | null {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return deny(403, "bad_request", "AI routes only accept requests from this app.");
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      /* malformed Origin: refused below */
    }
    if (!host || originHost !== host) return deny(403, "bad_request", "AI routes only accept requests from this app.");
  }

  const limit = Math.max(1, Number(process.env.AI_RATE_LIMIT) || 30);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(ip, recent);
    return deny(429, "rate_limited", "Too many AI requests from this address. Try again in a few minutes.");
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  return null;
}

/** Removes anything that looks like an API key from text that may reach the browser. */
export function scrubSecrets(text: string) {
  return text.replace(/\b(sk[-_][\w*.-]{6,}|AIza[\w*-]{10,})/g, "[redacted key]");
}
