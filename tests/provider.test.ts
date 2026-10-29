import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiConfig, callModel, resetProviderState, toStrictJsonSchema, verifyModel } from "@/lib/ai/provider";
import { POST } from "@/app/api/review/route";
import { NORTHSTAR } from "@/lib/seed/brand";

const ENV = ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_API_BASE", "GEMINI_API_KEY", "GEMINI_MODEL"];

function openAiReply(content: unknown, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ model: "gpt-5.4-mini", choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) }, ...extra }] }), { status: 200 });
}

beforeEach(() => {
  resetProviderState();
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
    resetProviderState(); // a rejected key is remembered; start fresh for the next case
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

  it("retries on Gemini when OpenAI fails and a Gemini key is set", async () => {
    vi.stubEnv("GEMINI_API_KEY", "g-test");
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("openai")
        ? new Response('{"error":{"code":"insufficient_quota"}}', { status: 429 })
        : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await callModel("s", "u", { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } } });
    expect(out).toMatchObject({ service: "Google Gemini API", model: "gemini-flash-latest", json: { ok: true }, fallbackFrom: { service: "OpenAI API", model: "gpt-5.4-mini" } });
    expect(out.fallbackFrom!.error).toMatch(/quota/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports both failures when the Gemini fallback fails too", async () => {
    vi.stubEnv("GEMINI_API_KEY", "g-test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    await expect(callModel("s", "u", { type: "OBJECT", properties: {} })).rejects.toThrow(/OpenAI is unavailable.*Google Gemini fallback also failed/);
  });

  it("does not fall back without a Gemini key", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(callModel("s", "u", { type: "OBJECT", properties: {} })).rejects.toMatchObject({ code: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("status points at Gemini when the OpenAI key is rejected", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-bad-fallback-status");
    vi.stubEnv("GEMINI_API_KEY", "g-ok-fallback-status");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response("{}", { status: url.includes("openai") ? 401 : 200 })));
    const v = await verifyModel();
    expect(v.verified).toBe("yes");
    expect(v.message).toMatch(/rejected by OpenAI.*Google Gemini \(gemini-flash-latest\) instead/);
    expect(v.fallback).toMatchObject({ provider: "Google Gemini", verified: "yes" });
  });

  it("skips a rejected OpenAI key on later calls and goes straight to Gemini", async () => {
    vi.stubEnv("GEMINI_API_KEY", "g-test");
    const gemini = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200 });
    const fetchMock = vi.fn(async (url: string) => (url.includes("openai") ? new Response("", { status: 401 }) : gemini()));
    vi.stubGlobal("fetch", fetchMock);
    await callModel("s", "u", { type: "OBJECT", properties: {} });
    await callModel("s", "u", { type: "OBJECT", properties: {} });
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes("openai"))).toHaveLength(1);
  });

  it("stops a slow provider within the budget and still leaves time for the fallback", async () => {
    vi.stubEnv("GEMINI_API_KEY", "g-test");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init: RequestInit) =>
        url.includes("openai")
          ? new Promise<Response>((_, reject) => init.signal!.addEventListener("abort", () => reject(Object.assign(new Error("t"), { name: "TimeoutError" }))))
          : Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200 })),
      ),
    );
    const t = Date.now();
    const out = await callModel("s", "u", { type: "OBJECT", properties: {} }, "probe", 5000);
    expect(Date.now() - t).toBeLessThan(4500); // OpenAI gets 60% of the budget
    expect(out.service).toBe("Google Gemini API");
    expect(out.fallbackFrom?.error).toMatch(/did not respond within 3 seconds/);
  });

  it("reports a missing key as not configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const res = await POST(new Request("http://local/api/review", { method: "POST", body: JSON.stringify({ text: "Hi", contentType: "Social post", meta: {}, brand: NORTHSTAR }) }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("not_configured");
  });
});
