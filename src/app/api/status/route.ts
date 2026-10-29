import { aiConfig, verifyModel } from "@/lib/ai/provider";
import type { AiStatusResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { configured, label, service, model } = aiConfig();
  const v = await verifyModel();
  return Response.json({ configured, provider: label, service, model, verified: v.verified, message: v.message, fallback: v.fallback } satisfies AiStatusResponse);
}
