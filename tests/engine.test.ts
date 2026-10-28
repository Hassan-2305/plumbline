import { describe, expect, it } from "vitest";
import { runDeterministic } from "@/lib/engine/deterministic";
import { contrastRatio, normalizeHex } from "@/lib/engine/contrast";
import { detectConflicts } from "@/lib/engine/conflicts";
import { coordinate } from "@/lib/engine/coordinator";
import { applyLocalFix, diffWords } from "@/lib/engine/diff";
import { numberTokens, findPhrase } from "@/lib/engine/text";
import { hashSimilarity, deltaE } from "@/lib/engine/color";
import { NORTHSTAR } from "@/lib/seed/brand";
import { EXAMPLES } from "@/lib/seed/examples";
import type { DraftFinding } from "@/lib/types";

const TODAY = "2026-10-29";
const run = (id: "A" | "B" | "C") => {
  const ex = EXAMPLES.find((e) => e.id === id)!;
  return runDeterministic({ text: ex.text, meta: ex.meta, brand: NORTHSTAR, today: TODAY });
};

describe("WCAG contrast", () => {
  it("matches known reference ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });
  it("normalises shorthand and rejects invalid hex", () => {
    expect(normalizeHex("#fff")).toBe("#FFFFFF");
    expect(normalizeHex("1c1c1e")).toBe("#1C1C1E");
    expect(normalizeHex("#12")).toBeNull();
    expect(normalizeHex("blue")).toBeNull();
  });
});

describe("Example A — social post", () => {
  const { findings } = run("A");
  const cats = findings.map((f) => f.category);
  it("flags the banned phrase with R-004 evidence and a minimal fix", () => {
    const f = findings.find((x) => x.category === "banned_term")!;
    expect(f.offendingText).toBe("miracle formula");
    expect(f.replacement).toBe("plant-based formula");
    expect(f.evidence.some((e) => e.type === "guideline" && e.id === "R-004" && e.verified)).toBe(true);
  });
  it("flags 40g as contradicting approved fact F-001", () => {
    const f = findings.find((x) => x.category === "contradicts_fact")!;
    expect(f.offendingText).toBe("40g");
    expect(f.evidence.some((e) => e.id === "F-001")).toBe(true);
  });
  it("flags the clinical claim and says no approved fact supports it", () => {
    const f = findings.find((x) => x.category === "clinical_claim")!;
    expect(f.severity).toBe("high");
    expect(f.evidence.some((e) => e.type === "no_fact")).toBe(true);
  });
  it("treats 50% as unsupported, not false", () => {
    const f = findings.find((x) => x.category === "unsupported_number")!;
    expect(f.explanation).toMatch(/does not prove the number is false/);
  });
  it("does not double-report 'miracle' as a superlative", () => {
    expect(cats.filter((c) => c === "superlative")).toHaveLength(0);
  });
});

describe("Example B — email", () => {
  const { findings, matchedFacts } = run("B");
  it("flags preferred-term violations", () => {
    expect(findings.filter((f) => f.category === "preferred_term").map((f) => f.offendingText?.toLowerCase())).toEqual(
      expect.arrayContaining(["vegan protein", "plant protein"]),
    );
  });
  it("flags the rating that relies on expired fact F-006", () => {
    const f = findings.find((x) => x.category === "expired_fact")!;
    expect(f.evidence.some((e) => e.id === "F-006")).toBe(true);
    expect(f.ruleIds).toEqual(["R-007"]);
  });
  it("records statements backed by active facts", () => {
    expect(matchedFacts.map((m) => m.factId)).toEqual(expect.arrayContaining(["F-001", "F-002"]));
  });
});

describe("Example C — mostly compliant hero", () => {
  const { findings } = run("C");
  it("raises the R-001/R-009 tone conflict instead of silently picking a side", () => {
    const f = findings.find((x) => x.category === "guideline_conflict")!;
    expect(f.ruleIds.sort()).toEqual(["R-001", "R-009"]);
    expect(f.replacement).toBeUndefined();
  });
  it("measures real contrast and flags missing alt text", () => {
    const c = findings.find((x) => x.category === "contrast")!;
    expect(c.title).toMatch(/2\.06:1/);
    expect(findings.some((x) => x.category === "missing_alt_text")).toBe(true);
  });
});

describe("rule roles", () => {
  it("cites the brand's own rule IDs, and none when a brand lacks that rule", () => {
    const bare = { ...NORTHSTAR, rules: [], ruleRoles: {} };
    const r = runDeterministic({ text: "Clinically proven to work.", meta: { hasImage: false, altText: "", fg: "", bg: "" }, brand: bare, today: TODAY });
    const f = r.findings.find((x) => x.category === "clinical_claim")!;
    expect(f.ruleIds).toEqual([]);
    expect(f.evidence.every((e) => e.type !== "guideline")).toBe(true);
  });
});

describe("video captions", () => {
  it("checks spoken claims through captions, located by timestamp", () => {
    const r = runDeterministic({
      text: "Promo video.",
      meta: {
        hasImage: false,
        altText: "",
        fg: "",
        bg: "",
        hasVideo: true,
        captions: { fileName: "x.vtt", cues: [{ start: 3, end: 5.5, text: "Our miracle formula is clinically proven to help." }] },
      },
      brand: NORTHSTAR,
      today: TODAY,
    });
    const banned = r.findings.find((f) => f.category === "banned_term")!;
    expect(banned.location).toBe("Captions 00:03");
    expect(banned.replacement).toBeUndefined();
  });
  it("flags a video with no captions", () => {
    const r = runDeterministic({ text: "x", meta: { hasImage: false, altText: "", fg: "", bg: "", hasVideo: true }, brand: NORTHSTAR, today: TODAY });
    expect(r.findings.some((f) => f.category === "missing_captions")).toBe(true);
  });
});

describe("text helpers", () => {
  it("extracts claim-like numbers but skips years and IDs", () => {
    expect(numberTokens("Since 2019, 24g and 78% — see F-001.").map((t) => t.raw)).toEqual(["24g", "78%"]);
  });
  it("matches phrases regardless of straight or curly apostrophes", () => {
    expect(findPhrase("The world's best coffee", "world’s best coffee")).toHaveLength(1);
  });
  it("applies a local fix only where the text exists", () => {
    expect(applyLocalFix("a miracle formula b", "miracle formula", "plant-based formula")).toBe("a plant-based formula b");
    expect(applyLocalFix("nothing here", "miracle", "x")).toBeNull();
  });
  it("diffs words", () => {
    const d = diffWords("a b c", "a x c");
    expect(d.filter((p) => p.type === "del").map((p) => p.text.trim())).toEqual(["b"]);
    expect(d.filter((p) => p.type === "add").map((p) => p.text.trim())).toEqual(["x"]);
  });
  it("compares colours and hashes", () => {
    expect(deltaE("#2F6B4F", "#2F6B4F")).toBe(0);
    expect(deltaE("#7C3AED", "#2F6B4F")).toBeGreaterThan(20);
    expect(hashSimilarity("ffffffffffffffff", "ffffffffffffffff")).toBe(1);
    expect(hashSimilarity("0000000000000000", "ffffffffffffffff")).toBe(0);
  });
});

describe("conflict detection", () => {
  it("finds the seeded R-001 / R-009 tone conflict", () => {
    const c = detectConflicts(NORTHSTAR.rules);
    expect(c.some((x) => x.ruleIds.join() === "R-001,R-009" && x.dimension === "tone register")).toBe(true);
  });
  it("finds nothing in unrelated rules", () => {
    expect(detectConflicts([{ id: "A", text: "Use approved logos." }, { id: "B", text: "Cite approved facts." }])).toEqual([]);
  });
});

describe("coordinator", () => {
  const base: DraftFinding = {
    juror: "Brand Guardian",
    severity: "high",
    category: "banned_term",
    title: "t",
    offendingText: "miracle formula",
    explanation: "e",
    evidence: [],
    suggestedFix: "f",
    confidence: null,
    source: "deterministic",
    verification: "verified",
    ruleIds: ["R-004"],
  };
  it("merges a corroborating AI finding into the deterministic one", () => {
    const out = coordinate([base], [{ ...base, source: "ai", confidence: 0.9 }]);
    expect(out).toHaveLength(1);
    expect(out[0].coordinatorNote).toMatch(/Corroborated/);
  });
  it("keeps both findings when jurors disagree on severity", () => {
    const out = coordinate([base], [{ ...base, source: "ai", severity: "low" }]);
    expect(out).toHaveLength(2);
    expect(out.every((f) => /Disagreement/.test(f.coordinatorNote ?? ""))).toBe(true);
  });
});
