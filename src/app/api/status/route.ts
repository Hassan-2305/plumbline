import { aiConfig, verifyModel } from "@/lib/ai/provider";
import type { AiStatusResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const primary = aiConfig();
  const v = await verifyModel();
  // When the primary key is rejected and the fallback works, report the provider actually doing the reviews.
  const { label, service, model } = v.active ?? primary;
  return Response.json({ configured: primary.configured, provider: label, service, model, verified: v.verified, message: v.message, fallback: v.fallback } satisfies AiStatusResponse);
}
