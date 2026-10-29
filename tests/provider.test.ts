import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiConfig, callModel, toStrictJsonSchema } from "@/lib/ai/provider";
import { POST } from "@/app/api/review/route";
import { NORTHSTAR } from "@/lib/seed/brand";

const ENV = ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_API_BASE", "GEMINI_API_KEY", "GEMINI_MODEL"];

function openAiReply(content: unknown, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ model: "gpt-5.4-mini", choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) }, ...extra }] }), { status: 200 });
}

beforeEach(() => {
  for (const k of ENV) vi.stubEnv(k, "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("provider selection", () => {
  it("prefers OpenAI when its key is set, falls back to Gemini, and reports neither as configured", () => {
    expect(aiConfig().configured).toBe(false);
    vi.stubEnv("GEMINI_API_KEY", "g");
    expect(aiConfig()).toMatchObject({ provider: "gemini", configured: true });
    vi.stubEnv("OPENAI_API_KEY", "o");
    expect(aiConfig()).toMatchObject({ provider: "openai", label: "OpenAI", model: "gpt-5.4-mini", configured: true });
  });
});

describe("strict JSON schema for OpenAI", () => {
  it("requires every property, makes optional ones nullable and forbids extra keys", () => {
    const s = toStrictJsonSchema({
      type: "OBJECT",
      properties: { a: { type: "STRING" }, b: { type: "STRING", enum: ["x", "y"] }, list: { type: "ARRAY", items: { type: "OBJECT", properties: { n: { type: "NUMBER" } } } } },
      required: ["a", "list"],
    });
    expect(s).toEqual({
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: ["string", "null"], enum: ["x", "y", null] },
        list: { type: "array", items: { type: "object", properties: { n: { type: ["number", "null"] } }, required: ["n"], additionalProperties: false } },
      },
      required: ["a", "b", "list"],
      additionalProperties: false,
    });
  });
});

describe("OpenAI calls", () => {
  beforeEach(() => vi.stubEnv("OPENAI_API_KEY", "sk-test"));

  it("sends a structured-output request with the key only in the Authorization header", async () => {
    const fetchMock = vi.fn(async () => openAiReply({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await callModel("sys", "user", { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } }, required: ["ok"] }, "probe");
    expect(out.json).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("gpt-5.4-mini");
    expect(body.response_format.json_schema).toMatchObject({ name: "probe", strict: true });
    expect(body.reasoning_effort).toBe("low");
    expect(JSON.stringify(body)).not.toContain("sk-test");
  });

  it("turns failures into errors instead of results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"code":"invalid_api_key"}}', { status: 401 })));
    await expect(callModel("s", "u", { type: "OBJECT", properties: {} })).rejects.toMatchObject({ code: "auth_failed" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"code":"insufficient_quota"}}', { status: 429 })));
    await expect(callModel("s", "u", { type: "OBJECT", properties: {} })).rejects.toThrow(/quota/);
    vi.stubGlobal("fetch", vi.fn(async () => openAiReply({}, { message: { refusal: "no", content: null } })));
    await expect(callModel("s", "u", { type: "OBJECT", properties: {} })).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("runs a full review through /api/review and validates the model's evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        openAiReply({
          findings: [
            { juror: "Risk & Compliance", severity: "high", category: "clinical_claim", title: "Unsupported clinical claim", offending_text: "clinically proven", explanation: "No approved study.", evidence: [{ type: "guideline", id: "R-005" }, { type: "no_fact", id: null }], suggested_fix: "Remove it.", replacement: "designed", confidence: 0.9 },
            { juror: "Fact-Checker", severity: "low", category: "unsupported_number", title: "Invented quote", offending_text: "not in the post", explanation: "x", evidence: [], suggested_fix: "x", replacement: null, confidence: 0.5 },
          ],
        }),
      ),
    );
    const res = await POST(
      new Request("http://local/api/review", {
        method: "POST",
        body: JSON.stringify({ text: "Our shake is clinically proven to help.", contentType: "Social post", meta: { hasImage: false, altText: "", fg: "", bg: "" }, brand: NORTHSTAR }),
      }),
    );
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.dropped).toBe(1); // the quote that isn't in the post
    expect(data.findings).toHaveLength(1);
    expect(data.findings[0]).toMatchObject({ source: "ai", verification: "verified", offendingText: "clinically proven", ruleIds: ["R-005"] });
  });

  it("reports a missing key as not configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const res = await POST(new Request("http://local/api/review", { method: "POST", body: JSON.stringify({ text: "Hi", contentType: "Social post", meta: {}, brand: NORTHSTAR }) }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("not_configured");
  });
});
