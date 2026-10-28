import { aiConfig, verifyModel } from "@/lib/ai/gemini";
import type { AiStatusResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { configured, model } = aiConfig();
  const v = await verifyModel();
  return Response.json({ configured, model, verified: v.verified, message: v.message } satisfies AiStatusResponse);
}
