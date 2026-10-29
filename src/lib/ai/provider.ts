import type { AiErrorCode } from "../types";

// Server-only model client. API keys never leave the server.
// OpenAI is used when OPENAI_API_KEY is set; otherwise Gemini if GEMINI_API_KEY is set.
// Every call asks for structured JSON and throws AiError on any failure — it never returns fake output.

export type ProviderId = "openai" | "gemini";

const PROVIDERS = {
  openai: {
    label: "OpenAI",
    service: "OpenAI API",
    keyVar: "OPENAI_API_KEY",
    modelVar: "OPENAI_MODEL",
    defaultModel: "gpt-5.4-mini",
    // *_API_BASE is only for pointing tests at a local mock.
    base: () => process.env.OPENAI_API_BASE?.trim() || "https://api.openai.com/v1",
  },
  gemini: {
    label: "Google Gemini",
    service: "Google Gemini API",
    keyVar: "GEMINI_API_KEY",
    modelVar: "GEMINI_MODEL",
    defaultModel: "gemini-2.5-flash",
    base: () => process.env.GEMINI_API_BASE?.trim() || "https://generativelanguage.googleapis.com/v1beta",
  },
} as const;

export function aiConfig() {
  const id: ProviderId = process.env.OPENAI_API_KEY?.trim() ? "openai" : process.env.GEMINI_API_KEY?.trim() ? "gemini" : "openai";
  const p = PROVIDERS[id];
  const key = process.env[p.keyVar]?.trim() || "";
  const model = process.env[p.modelVar]?.trim() || p.defaultModel;
  return { provider: id, label: p.label, service: p.service, keyVar: p.keyVar, modelVar: p.modelVar, key, model, configured: key.length > 0 };
}

export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string) {
    super(message);
  }
}

let statusCache: { at: number; key: string; ok: boolean; message: string } | null = null;

/** Checks the configured model exists for this key (metadata call, no generation cost). */
export async function verifyModel() {
  const { provider, label, keyVar, modelVar, key, model, configured } = aiConfig();
  if (!configured) return { verified: "no" as const, message: "No AI key is set on the server (OPENAI_API_KEY)." };
  const cacheKey = `${provider}:${model}`;
  if (statusCache && statusCache.key === cacheKey && Date.now() - statusCache.at < 10 * 60_000) {
    return { verified: statusCache.ok ? ("yes" as const) : ("no" as const), message: statusCache.message };
  }
  try {
    const base = PROVIDERS[provider].base();
    const res =
      provider === "openai"
        ? await fetch(`${base}/models/${encodeURIComponent(model)}`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) })
        : await fetch(`${base}/models/${encodeURIComponent(model)}`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(8000) });
    const ok = res.ok;
    const message = ok
      ? `Model ${model} is available to this API key.`
      : res.status === 404
        ? `Model ${model} was not found for this key. Set ${modelVar} to an available model.`
        : res.status === 400 || res.status === 401 || res.status === 403
          ? `The ${keyVar} was rejected by ${label}.`
          : `${label} returned HTTP ${res.status} while checking the model.`;
    statusCache = { at: Date.now(), key: cacheKey, ok, message };
    return { verified: ok ? ("yes" as const) : ("no" as const), message };
  } catch {
    return { verified: "unchecked" as const, message: `Could not reach ${label} to verify the model.` };
  }
}

/**
 * Converts the app's schema notation (Gemini-style upper-case types) to a JSON
 * Schema that OpenAI's strict structured outputs accept: every property is
 * required, optional ones become nullable, and no extra keys are allowed.
 */
export function toStrictJsonSchema(s: Record<string, unknown>, nullable = false): Record<string, unknown> {
  const type = String(s.type).toLowerCase();
  const out: Record<string, unknown> = { type: nullable ? [type, "null"] : type };
  if (Array.isArray(s.enum)) out.enum = nullable ? [...s.enum, null] : s.enum;
  if (type === "array") out.items = toStrictJsonSchema(s.items as Record<string, unknown>);
  if (type === "object") {
    const props = (s.properties ?? {}) as Record<string, Record<string, unknown>>;
    const required = new Set((s.required as string[] | undefined) ?? []);
    out.properties = Object.fromEntries(Object.entries(props).map(([k, v]) => [k, toStrictJsonSchema(v, !required.has(k))]));
    out.required = Object.keys(props);
    out.additionalProperties = false;
  }
  return out;
}

function httpError(label: string, keyVar: string, modelVar: string, model: string, status: number, body: string): AiError {
  if (status === 429)
    return /insufficient_quota/i.test(body)
      ? new AiError("rate_limited", `${label} says this key has no remaining quota or billing. Check the account’s usage limits.`)
      : new AiError("rate_limited", `${label} rate limit reached. Try again shortly.`);
  if (status === 401 || status === 403 || /API key not valid|invalid_api_key/i.test(body)) return new AiError("auth_failed", `${label} rejected the ${keyVar}.`);
  if (status === 404 || /model_not_found/i.test(body)) return new AiError("bad_request", `Model "${model}" is not available for this key. Set ${modelVar}.`);
  if (status >= 500) return new AiError("unavailable", `${label} is unavailable (HTTP ${status}).`);
  return new AiError("bad_request", `${label} rejected the request (HTTP ${status}).`);
}

async function send(label: string, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    throw new AiError("unavailable", timeout ? `${label} did not respond within 60 seconds.` : `Could not reach ${label}.`);
  }
}

function parse(label: string, text: string | undefined, why?: string) {
  if (!text) throw new AiError("invalid_response", `${label} returned no usable output${why ? ` (${why})` : ""}.`);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiError("invalid_response", `${label} returned malformed JSON. No AI results were recorded.`);
  }
}

/** One structured model call: system instructions, untrusted user content, and the expected output schema. */
export async function callModel(system: string, user: string, schema: Record<string, unknown>, name = "result"): Promise<{ model: string; json: unknown }> {
  const { provider, label, keyVar, modelVar, key, model, configured } = aiConfig();
  if (!configured) throw new AiError("not_configured", `Live AI is not configured (${keyVar} missing).`);
  const base = PROVIDERS[provider].base();

  if (provider === "openai") {
    // Reasoning models (GPT-5 family, o-series) spend output tokens thinking; keep that short.
    const reasoning = /^(gpt-5|o\d)/.test(model) ? { reasoning_effort: "low" } : {};
    const res = await send(label, `${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_schema", json_schema: { name, strict: true, schema: toStrictJsonSchema(schema) } },
        max_completion_tokens: 8000,
        ...reasoning,
      }),
    });
    if (!res.ok) throw httpError(label, keyVar, modelVar, model, res.status, await res.text().catch(() => ""));
    const data = await res.json().catch(() => null);
    const choice = data?.choices?.[0];
    if (choice?.message?.refusal) throw new AiError("invalid_response", `${label} declined to review this content.`);
    if (choice?.finish_reason === "length") throw new AiError("invalid_response", `${label} ran out of output tokens before finishing. No AI results were recorded.`);
    return { model: data?.model ?? model, json: parse(label, choice?.message?.content, choice?.finish_reason) };
  }

  const res = await send(label, `${base}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: "application/json", responseSchema: schema },
    }),
  });
  if (!res.ok) throw httpError(label, keyVar, modelVar, model, res.status, await res.text().catch(() => ""));
  const data = await res.json().catch(() => null);
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  return { model, json: parse(label, text, data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason) };
}
