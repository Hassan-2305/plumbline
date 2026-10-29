import { analyzeConflicts } from "@/lib/ai/conflicts";
import { AiError } from "@/lib/ai/provider";
import type { ConflictAnalysisRequest, ConflictAnalysisResponse } from "@/lib/types";

import { guardAiRequest } from "@/lib/ai/guard";

export const dynamic = "force-dynamic";

function fail(code: Extract<ConflictAnalysisResponse, { ok: false }>["error"]["code"], message: string, status: number) {
  return Response.json({ ok: false, error: { code, message } } satisfies ConflictAnalysisResponse, { status });
}

export async function POST(request: Request) {
  const blocked = guardAiRequest(request);
  if (blocked) return blocked;
  let body: ConflictAnalysisRequest;
  try {
    body = await request.json();
  } catch {
    return fail("bad_request", "Request body must be JSON.", 400);
  }
  const rules = Array.isArray(body?.rules)
    ? body.rules.filter((r) => r && typeof r.id === "string" && typeof r.text === "string" && r.text.trim())
    : [];
  if (rules.length < 2) return fail("bad_request", "At least two rules are needed to look for conflicts.", 400);
  if (rules.length > 60 || rules.reduce((n, r) => n + r.text.length, 0) > 12000) {
    return fail("bad_request", "Too much guideline text for one analysis (max 60 rules / 12,000 characters).", 400);
  }
  try {
    const result = await analyzeConflicts({ rules });
    return Response.json({ ok: true, ...result } satisfies ConflictAnalysisResponse);
  } catch (e) {
    if (e instanceof AiError) {
      const status = e.code === "not_configured" ? 503 : e.code === "rate_limited" ? 429 : e.code === "bad_request" ? 400 : 502;
      return fail(e.code, e.message, status);
    }
    return fail("unavailable", "Unexpected error while analysing guidelines.", 500);
  }
}
