import { AiError } from "@/lib/ai/provider";
import { extractRulesWithAi } from "@/lib/ai/extract";

import { guardAiRequest } from "@/lib/ai/guard";

export const dynamic = "force-dynamic";

const MAX = 30000;

function fail(code: string, message: string, status: number) {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const blocked = guardAiRequest(request);
  if (blocked) return blocked;
  let body: { text?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("bad_request", "Request body must be JSON.", 400);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 40) return fail("bad_request", "Not enough text to extract rules from.", 400);
  if (text.length > MAX) return fail("bad_request", `Document text exceeds ${MAX.toLocaleString()} characters. Import a shorter section.`, 400);
  try {
    return Response.json({ ok: true, ...(await extractRulesWithAi(text)) });
  } catch (e) {
    if (e instanceof AiError) {
      const status = e.code === "not_configured" ? 503 : e.code === "rate_limited" ? 429 : e.code === "bad_request" ? 400 : 502;
      return fail(e.code, e.message, status);
    }
    return fail("unavailable", "Unexpected error while extracting rules.", 500);
  }
}
