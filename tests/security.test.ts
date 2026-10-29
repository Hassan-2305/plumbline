import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { guardAiRequest, scrubSecrets } from "@/lib/ai/guard";

afterEach(() => vi.unstubAllEnvs());

const req = (headers: Record<string, string>) => new Request("http://app.test/api/review", { method: "POST", headers: { host: "app.test", ...headers } });

describe("AI route guard", () => {
  it("lets the app's own pages through", () => {
    expect(guardAiRequest(req({ origin: "http://app.test", "sec-fetch-site": "same-origin", "x-forwarded-for": "10.0.0.1" }))).toBeNull();
  });

  it("refuses requests sent from another website", async () => {
    const res = guardAiRequest(req({ origin: "https://evil.example", "sec-fetch-site": "cross-site", "x-forwarded-for": "10.0.0.2" }));
    expect(res?.status).toBe(403);
    expect(guardAiRequest(req({ origin: "https://evil.example", "x-forwarded-for": "10.0.0.2" }))?.status).toBe(403);
    expect(guardAiRequest(req({ origin: "not a url", "x-forwarded-for": "10.0.0.2" }))?.status).toBe(403);
  });

  it("rate-limits each client address", async () => {
    vi.stubEnv("AI_RATE_LIMIT", "3");
    const from = (ip: string) => guardAiRequest(req({ "x-forwarded-for": ip }));
    expect([from("10.0.0.3"), from("10.0.0.3"), from("10.0.0.3")]).toEqual([null, null, null]);
    const blocked = from("10.0.0.3");
    expect(blocked?.status).toBe(429);
    expect((await blocked!.json()).error.code).toBe("rate_limited");
    expect(from("10.0.0.4")).toBeNull(); // other clients are unaffected
  });
});

describe("secret scrubbing", () => {
  it("removes OpenAI- and Google-style keys from error text", () => {
    const s = scrubSecrets("Incorrect API key provided: sk-proj-abc123DEF456ghi and AIzaSyA1234567890abcdefXYZ, also sk_95ac8****2f89.");
    expect(s).not.toMatch(/sk-proj|AIza|sk_95/);
    expect(s.match(/\[redacted key\]/g)).toHaveLength(3);
  });
});

describe("keys stay on the server", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
    });

  it("only the server-only provider module reads API keys, and nothing exposes them as NEXT_PUBLIC_", () => {
    for (const f of files("src")) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/NEXT_PUBLIC_/);
      if (/_API_KEY/.test(src) && /process\.env/.test(src)) expect(f.replace(/\\/g, "/")).toBe("src/lib/ai/provider.ts");
      if (/^["']use client["']/.test(src)) expect(src, f).not.toMatch(/@\/lib\/ai\/(provider|review|conflicts|extract|guard)/);
    }
    expect(readFileSync("src/lib/ai/provider.ts", "utf8")).toMatch(/^import "server-only";/);
  });

  it("git ignores local env files but keeps the example", () => {
    const ignore = readFileSync(".gitignore", "utf8");
    expect(ignore).toMatch(/^\.env\*$/m);
    expect(ignore).toMatch(/^!\.env\.example$/m);
    expect(readFileSync(".env.example", "utf8")).toMatch(/^OPENAI_API_KEY=$/m);
    expect(readFileSync(".env.example", "utf8")).toMatch(/^GEMINI_API_KEY=$/m);
  });
});
