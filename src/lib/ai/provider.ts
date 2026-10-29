import "server-only";
import type { AiErrorCode } from "../types";
import { scrubSecrets } from "./guard";

// Server-only model client. API keys never leave the server.
// OpenAI is used when OPENAI_API_KEY is set; otherwise Gemini if GEMINI_API_KEY is set.
// When both keys are set and an OpenAI call fails, the same request is retried on Gemini.
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
    defaultModel: "gemini-flash-latest",
    base: () => process.env.GEMINI_API_BASE?.trim() || "https://generativelanguage.googleapis.com/v1beta",
  },
} as const;

function providerConfig(id: ProviderId) {
  const p = PROVIDERS[id];
  const key = process.env[p.keyVar]?.trim() || "";
  const model = process.env[p.modelVar]?.trim() || p.defaultModel;
  return { provider: id, label: p.label, service: p.service, keyVar: p.keyVar, modelVar: p.modelVar, key, model, configured: key.length > 0 };
}
type ProviderConfig = ReturnType<typeof providerConfig>;

/** The provider tried first. */
export function aiConfig() {
  const id: ProviderId = process.env.OPENAI_API_KEY?.trim() ? "openai" : process.env.GEMINI_API_KEY?.trim() ? "gemini" : "openai";
  return providerConfig(id);
}

/** Gemini, when OpenAI is primary and a Gemini key is also set. */
export function fallbackConfig(): ProviderConfig | null {
  if (aiConfig().provider !== "openai") return null;
  const g = providerConfig("gemini");
  return g.configured ? g : null;
}

export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string) {
    super(message);
  }
}

const statusCache = new Map<string, { at: number; ok: boolean; message: string }>();

/**
 * Checks the configured model works for this key. OpenAI: a free metadata call.
 * Gemini: a tiny generation, because Google keeps listing models that new keys
 * can no longer call ("no longer available to new users").
 */
async function checkProvider(cfg: ProviderConfig): Promise<{ verified: "yes" | "no" | "unchecked"; message: string }> {
  const { provider, label, keyVar, modelVar, key, model } = cfg;
  const cacheKey = `${provider}:${model}:${key.slice(-6)}`;
  const hit = statusCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 10 * 60_000) return { verified: hit.ok ? "yes" : "no", message: hit.message };
  try {
    const base = PROVIDERS[provider].base();
    const res =
      provider === "openai"
        ? await fetch(`${base}/models/${encodeURIComponent(model)}`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) })
        : await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with: ok" }] }], generationConfig: { maxOutputTokens: 16 } }),
            signal: AbortSignal.timeout(15000),
          });
    const ok = res.ok;
    const detail = ok ? "" : scrubSecrets(String((await res.json().catch(() => null))?.error?.message ?? "").split(". ")[0]);
    const notOpenAiKey = provider === "openai" && !key.startsWith("sk-") ? " It doesn’t look like an OpenAI key (those start with “sk-”)." : "";
    const message = ok
      ? `${label} model ${model} is working with this API key.`
      : res.status === 404
        ? `${label} model ${model} can’t be used with this key${detail ? ` (${detail})` : ""}. Set ${modelVar} to an available model.`
        : res.status === 400 || res.status === 401 || res.status === 403
          ? `The ${keyVar} was rejected by ${label}.${notOpenAiKey}`
          : res.status === 429
            ? `${label} rate limit or quota reached for this key.`
            : `${label} returned HTTP ${res.status} while checking the model.`;
    // Rate limits, quota and provider outages pass; report them without switching the AI off or caching them.
    if (res.status === 429 || res.status >= 500) return { verified: "unchecked", message };
    statusCache.set(cacheKey, { at: Date.now(), ok, message });
    return { verified: ok ? "yes" : "no", message };
  } catch {
    return { verified: "unchecked", message: `Could not reach ${label} to verify the model.` };
  }
}

/** Status of the primary provider, and of the Gemini fallback when one is configured. */
export async function verifyModel() {
  const primary = aiConfig();
  if (!primary.configured) return { verified: "no" as const, message: "No AI key is set on the server (OPENAI_API_KEY).", fallback: null, active: null };
  const fb = fallbackConfig();
  const [p, f] = await Promise.all([checkProvider(primary), fb ? checkProvider(fb) : Promise.resolve(null)]);
  const fallback = fb && f ? { provider: fb.label, model: fb.model, verified: f.verified } : null;
  if (p.verified === "no" && fb && f && f.verified !== "no") {
    return { verified: f.verified, message: `${p.message} Reviews will use ${fb.label} (${fb.model}) instead.`, fallback, active: fb };
  }
  const extra = fb && f ? (f.verified === "no" ? ` The ${fb.label} fallback has a problem: ${f.message}` : ` If it fails, ${fb.label} (${fb.model}) is used as a fallback.`) : "";
  return { verified: p.verified, message: p.message + extra, fallback, active: null };
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

async function send(label: string, url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    throw new AiError("unavailable", timeout ? `${label} did not respond within ${Math.round(timeoutMs / 1000)} seconds.` : `Could not reach ${label}.`);
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

export interface ModelResult {
  model: string;
  /** The service that produced the answer, for the AI disclosure ledger. */
  service: string;
  json: unknown;
  /** Set when the primary provider failed and Gemini answered instead. */
  fallbackFrom?: { service: string; model: string; error: string };
}

/**
 * One structured model call: system instructions, untrusted user content, and
 * the expected output schema. Falls back to Gemini when OpenAI fails and a
 * Gemini key is set.
 */
// A provider whose key was rejected is skipped for a while, so every call
// doesn't wait for the same refusal before trying the fallback.
const rejectedUntil = new Map<string, number>();

/** Clears remembered key rejections and status checks (tests only). */
export function resetProviderState() {
  rejectedUntil.clear();
  statusCache.clear();
}

export async function callModel(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  name = "result",
  /** Total time for the call, fallback included. */
  budgetMs = 60_000,
): Promise<ModelResult> {
  const primary = aiConfig();
  if (!primary.configured) throw new AiError("not_configured", `Live AI is not configured (${primary.keyVar} missing).`);
  const fb = fallbackConfig();
  const deadline = Date.now() + budgetMs;
  const primaryKey = `${primary.provider}:${primary.key.slice(-6)}`;
  try {
    if ((rejectedUntil.get(primaryKey) ?? 0) > Date.now()) throw new AiError("auth_failed", `${primary.label} rejected the ${primary.keyVar}.`);
    // Leave the fallback at least 40% of the budget.
    const r = await callProvider(primary, system, user, schema, name, fb ? budgetMs * 0.6 : budgetMs);
    return { ...r, service: primary.service };
  } catch (e) {
    if (e instanceof AiError && e.code === "auth_failed") rejectedUntil.set(primaryKey, Date.now() + 10 * 60_000);
    const remaining = deadline - Date.now();
    if (!(e instanceof AiError) || !fb || remaining < 1500) throw e;
    try {
      const r = await callProvider(fb, system, user, schema, name, remaining);
      return { ...r, service: fb.service, fallbackFrom: { service: primary.service, model: primary.model, error: e.message } };
    } catch (e2) {
      const code = e2 instanceof AiError ? e2.code : "unavailable";
      throw new AiError(code, `${e.message} The ${fb.label} fallback also failed: ${e2 instanceof Error ? e2.message : "unknown error"}`);
    }
  }
}

async function callProvider(cfg: ProviderConfig, system: string, user: string, schema: Record<string, unknown>, name: string, timeoutMs: number): Promise<{ model: string; json: unknown }> {
  const { provider, label, keyVar, modelVar, key, model } = cfg;
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
    }, timeoutMs);
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
  }, timeoutMs);
  if (!res.ok) throw httpError(label, keyVar, modelVar, model, res.status, await res.text().catch(() => ""));
  const data = await res.json().catch(() => null);
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  // Aliases such as gemini-flash-latest report the concrete model that answered.
  return { model: data?.modelVersion ?? model, json: parse(label, text, data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason) };
}
