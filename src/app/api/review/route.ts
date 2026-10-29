import { AiError } from "@/lib/ai/provider";
import { runAiReview } from "@/lib/ai/review";
import type { AiReviewRequest, AiReviewResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_CHARS = 8000;

function fail(code: Extract<AiReviewResponse, { ok: false }>["error"]["code"], message: string, status: number) {
  return Response.json({ ok: false, error: { code, message } } satisfies AiReviewResponse, { status });
}

export async function POST(request: Request) {
  let body: AiReviewRequest;
  try {
    body = await request.json();
  } catch {
    return fail("bad_request", "Request body must be JSON.", 400);
  }
  if (!body?.text || typeof body.text !== "string" || !body.text.trim()) {
    return fail("bad_request", "Content is empty.", 400);
  }
  if (body.text.length > MAX_CHARS) {
    return fail("bad_request", `Content exceeds ${MAX_CHARS} characters.`, 400);
  }
  if (!Array.isArray(body.brand?.rules) || !Array.isArray(body.brand?.facts)) {
    return fail("bad_request", "Brand rules and facts are required.", 400);
  }
  try {
    const result = await runAiReview(body);
    return Response.json({ ok: true, ...result } satisfies AiReviewResponse);
  } catch (e) {
    if (e instanceof AiError) {
      const status = e.code === "not_configured" ? 503 : e.code === "rate_limited" ? 429 : e.code === "bad_request" ? 400 : 502;
      return fail(e.code, e.message, status);
    }
    return fail("unavailable", "Unexpected error while running AI review.", 500);
  }
}
